"""
WeBull Trade History Analyzer
Parses WeBull CSV exports and calculates trade-level P/L

Author: Swjsh Algo Knife
"""

import csv
import json
import re
from datetime import datetime
from pathlib import Path
from collections import defaultdict
from dataclasses import dataclass, asdict
from typing import List, Dict, Tuple, Optional


@dataclass
class Order:
    """Represents a single order from WeBull CSV"""
    symbol: str
    underlying: str
    option_type: str  # 'C' or 'P'
    strike: float
    expiration: str
    side: str  # 'Buy' or 'Sell'
    status: str
    filled_qty: int
    total_qty: int
    price: float
    avg_price: float
    time_in_force: str
    placed_time: datetime
    filled_time: Optional[datetime]
    raw_name: str


@dataclass
class Trade:
    """Represents a complete round-trip trade (buy + sell)"""
    symbol: str
    underlying: str
    option_type: str
    strike: float
    expiration: str
    entry_time: datetime
    exit_time: datetime
    entry_price: float
    exit_price: float
    quantity: int
    pnl: float
    pnl_percent: float
    hold_time_minutes: float
    direction: str  # 'long' or 'short'


def parse_option_symbol(symbol: str) -> Tuple[str, str, str, float]:
    """
    Parse WeBull option symbol format.
    Example: SPXW230922C04370000 -> (SPX, 2023-09-22, C, 4370.00)
    """
    # Pattern: UNDERLYING + YYMMDD + C/P + STRIKE (strike * 1000)
    pattern = r'^([A-Z]+)(\d{6})([CP])(\d+)$'
    match = re.match(pattern, symbol)
    
    if not match:
        return (symbol, "", "", 0.0)
    
    underlying = match.group(1)
    # Remove trailing 'W' from SPXW to get SPX
    if underlying.endswith('W'):
        underlying = underlying[:-1]
    
    date_str = match.group(2)
    year = 2000 + int(date_str[:2])
    month = int(date_str[2:4])
    day = int(date_str[4:6])
    expiration = f"{year}-{month:02d}-{day:02d}"
    
    option_type = match.group(3)
    strike = int(match.group(4)) / 1000
    
    return (underlying, expiration, option_type, strike)


def parse_datetime(dt_str: str) -> Optional[datetime]:
    """Parse WeBull datetime format"""
    if not dt_str or dt_str.strip() == '':
        return None
    
    # Format: 09/22/2023 11:40:54 EDT
    try:
        # Remove timezone suffix
        dt_str = dt_str.replace(' EDT', '').replace(' EST', '').strip()
        return datetime.strptime(dt_str, '%m/%d/%Y %H:%M:%S')
    except ValueError:
        return None


def parse_price(price_str: str) -> float:
    """Parse price from CSV (handles @ prefix)"""
    if not price_str:
        return 0.0
    price_str = price_str.replace('@', '').strip()
    try:
        return float(price_str)
    except ValueError:
        return 0.0


def load_orders_from_csv(filepath: Path) -> List[Order]:
    """Load and parse orders from a WeBull CSV file"""
    orders = []
    
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            symbol = row.get('Symbol', '').strip()
            if not symbol:
                continue
            
            status = row.get('Status', '').strip()
            # Skip cancelled orders
            if status == 'Cancelled':
                continue
            
            filled_qty = int(row.get('Filled', 0) or 0)
            if filled_qty == 0:
                continue
            
            underlying, expiration, option_type, strike = parse_option_symbol(symbol)
            
            avg_price_str = row.get('Avg Price', '')
            avg_price = parse_price(avg_price_str)
            
            price_str = row.get('Price', '')
            price = parse_price(price_str)
            
            placed_time = parse_datetime(row.get('Placed Time', ''))
            filled_time = parse_datetime(row.get('Filled Time', ''))
            
            if not placed_time:
                continue
            
            order = Order(
                symbol=symbol,
                underlying=underlying,
                option_type=option_type,
                strike=strike,
                expiration=expiration,
                side=row.get('Side', '').strip(),
                status=status,
                filled_qty=filled_qty,
                total_qty=int(row.get('Total Qty', 0) or 0),
                price=price,
                avg_price=avg_price if avg_price > 0 else price,
                time_in_force=row.get('Time-in-Force', '').strip(),
                placed_time=placed_time,
                filled_time=filled_time,
                raw_name=row.get('Name', '').strip()
            )
            orders.append(order)
    
    return orders


def pair_trades(orders: List[Order]) -> List[Trade]:
    """
    Match buy and sell orders to create complete trades.
    Uses FIFO matching per symbol.
    """
    # Group orders by symbol
    orders_by_symbol = defaultdict(list)
    for order in orders:
        orders_by_symbol[order.symbol].append(order)
    
    trades = []
    
    for symbol, symbol_orders in orders_by_symbol.items():
        # Sort by filled time
        symbol_orders.sort(key=lambda x: x.filled_time or x.placed_time)
        
        # Separate buys and sells
        buys = []
        sells = []
        
        for order in symbol_orders:
            if order.side == 'Buy':
                buys.append({'order': order, 'remaining': order.filled_qty})
            elif order.side == 'Sell':
                sells.append({'order': order, 'remaining': order.filled_qty})
        
        # FIFO matching
        buy_idx = 0
        sell_idx = 0
        
        while buy_idx < len(buys) and sell_idx < len(sells):
            buy = buys[buy_idx]
            sell = sells[sell_idx]
            
            buy_order = buy['order']
            sell_order = sell['order']
            
            # Determine which came first (long vs short position)
            buy_time = buy_order.filled_time or buy_order.placed_time
            sell_time = sell_order.filled_time or sell_order.placed_time
            
            match_qty = min(buy['remaining'], sell['remaining'])
            
            if buy_time <= sell_time:
                # Long trade: bought then sold
                direction = 'long'
                entry_time = buy_time
                exit_time = sell_time
                entry_price = buy_order.avg_price
                exit_price = sell_order.avg_price
            else:
                # Short trade: sold then bought (closing short)
                direction = 'short'
                entry_time = sell_time
                exit_time = buy_time
                entry_price = sell_order.avg_price
                exit_price = buy_order.avg_price
            
            # Calculate P/L (per contract, options are 100 shares)
            if direction == 'long':
                pnl = (exit_price - entry_price) * match_qty * 100
            else:
                pnl = (entry_price - exit_price) * match_qty * 100
            
            pnl_percent = ((exit_price - entry_price) / entry_price * 100) if entry_price > 0 else 0
            if direction == 'short':
                pnl_percent = -pnl_percent
            
            hold_time = (exit_time - entry_time).total_seconds() / 60
            
            trade = Trade(
                symbol=symbol,
                underlying=buy_order.underlying,
                option_type=buy_order.option_type,
                strike=buy_order.strike,
                expiration=buy_order.expiration,
                entry_time=entry_time,
                exit_time=exit_time,
                entry_price=entry_price,
                exit_price=exit_price,
                quantity=match_qty,
                pnl=pnl,
                pnl_percent=pnl_percent,
                hold_time_minutes=hold_time,
                direction=direction
            )
            trades.append(trade)
            
            # Update remaining quantities
            buy['remaining'] -= match_qty
            sell['remaining'] -= match_qty
            
            if buy['remaining'] == 0:
                buy_idx += 1
            if sell['remaining'] == 0:
                sell_idx += 1
    
    return trades


def calculate_statistics(trades: List[Trade]) -> Dict:
    """Calculate overall trading statistics"""
    if not trades:
        return {}
    
    winners = [t for t in trades if t.pnl > 0]
    losers = [t for t in trades if t.pnl < 0]
    breakeven = [t for t in trades if t.pnl == 0]
    
    total_pnl = sum(t.pnl for t in trades)
    total_wins = sum(t.pnl for t in winners)
    total_losses = sum(t.pnl for t in losers)
    
    avg_win = total_wins / len(winners) if winners else 0
    avg_loss = total_losses / len(losers) if losers else 0
    
    win_rate = len(winners) / len(trades) * 100 if trades else 0
    
    # Profit factor
    profit_factor = abs(total_wins / total_losses) if total_losses != 0 else float('inf')
    
    # Average hold time
    avg_hold_time = sum(t.hold_time_minutes for t in trades) / len(trades)
    
    # By underlying
    by_underlying = defaultdict(lambda: {'trades': 0, 'pnl': 0, 'winners': 0})
    for t in trades:
        by_underlying[t.underlying]['trades'] += 1
        by_underlying[t.underlying]['pnl'] += t.pnl
        if t.pnl > 0:
            by_underlying[t.underlying]['winners'] += 1
    
    return {
        'total_trades': len(trades),
        'winners': len(winners),
        'losers': len(losers),
        'breakeven': len(breakeven),
        'win_rate': round(win_rate, 2),
        'total_pnl': round(total_pnl, 2),
        'avg_win': round(avg_win, 2),
        'avg_loss': round(avg_loss, 2),
        'profit_factor': round(profit_factor, 2) if profit_factor != float('inf') else 'Infinite',
        'avg_hold_time_minutes': round(avg_hold_time, 2),
        'by_underlying': {k: dict(v) for k, v in by_underlying.items()}
    }


def analyze_time_patterns(trades: List[Trade]) -> Dict:
    """Analyze profitability by time of day"""
    by_hour = defaultdict(lambda: {'trades': 0, 'pnl': 0, 'winners': 0})
    
    for t in trades:
        hour = t.entry_time.hour
        by_hour[hour]['trades'] += 1
        by_hour[hour]['pnl'] += t.pnl
        if t.pnl > 0:
            by_hour[hour]['winners'] += 1
    
    result = {}
    for hour in sorted(by_hour.keys()):
        data = by_hour[hour]
        win_rate = data['winners'] / data['trades'] * 100 if data['trades'] > 0 else 0
        result[f"{hour:02d}:00"] = {
            'trades': data['trades'],
            'pnl': round(data['pnl'], 2),
            'win_rate': round(win_rate, 2)
        }
    
    return result


def main():
    """Main analysis entry point"""
    base_path = Path(__file__).parent.parent
    history_path = base_path / 'docs' / 'WeBull History'
    output_path = base_path / 'data'
    output_path.mkdir(exist_ok=True)
    
    all_orders = []
    
    # Load all CSV files
    for year in ['2021', '2022', '2023']:
        csv_path = history_path / year / 'Webull_Orders_Records_Options.csv'
        if csv_path.exists():
            print(f"Loading {year} data...")
            orders = load_orders_from_csv(csv_path)
            print(f"  Found {len(orders)} filled orders")
            all_orders.extend(orders)
    
    print(f"\nTotal orders loaded: {len(all_orders)}")
    
    # Pair trades
    print("\nPairing buy/sell orders into trades...")
    trades = pair_trades(all_orders)
    print(f"Created {len(trades)} complete trades")
    
    # Calculate statistics
    print("\nCalculating statistics...")
    stats = calculate_statistics(trades)
    time_patterns = analyze_time_patterns(trades)
    
    # Print summary
    print("\n" + "="*60)
    print("TRADE ANALYSIS SUMMARY")
    print("="*60)
    print(f"Total Trades: {stats['total_trades']}")
    print(f"Win Rate: {stats['win_rate']}%")
    print(f"Total P/L: ${stats['total_pnl']:,.2f}")
    print(f"Average Win: ${stats['avg_win']:,.2f}")
    print(f"Average Loss: ${stats['avg_loss']:,.2f}")
    print(f"Profit Factor: {stats['profit_factor']}")
    print(f"Avg Hold Time: {stats['avg_hold_time_minutes']:.1f} minutes")
    
    print("\n" + "-"*40)
    print("P/L BY UNDERLYING")
    print("-"*40)
    sorted_underlyings = sorted(
        stats['by_underlying'].items(),
        key=lambda x: x[1]['pnl'],
        reverse=True
    )
    for underlying, data in sorted_underlyings[:15]:
        win_rate = data['winners'] / data['trades'] * 100 if data['trades'] > 0 else 0
        print(f"  {underlying:8} | {data['trades']:4} trades | ${data['pnl']:>10,.2f} | {win_rate:5.1f}% WR")
    
    print("\n" + "-"*40)
    print("P/L BY HOUR (Entry Time)")
    print("-"*40)
    for hour, data in time_patterns.items():
        print(f"  {hour} | {data['trades']:4} trades | ${data['pnl']:>10,.2f} | {data['win_rate']:5.1f}% WR")
    
    # Save results
    results = {
        'generated_at': datetime.now().isoformat(),
        'statistics': stats,
        'time_patterns': time_patterns,
        'trades': [
            {
                'symbol': t.symbol,
                'underlying': t.underlying,
                'option_type': t.option_type,
                'strike': t.strike,
                'expiration': t.expiration,
                'entry_time': t.entry_time.isoformat(),
                'exit_time': t.exit_time.isoformat(),
                'entry_price': t.entry_price,
                'exit_price': t.exit_price,
                'quantity': t.quantity,
                'pnl': round(t.pnl, 2),
                'pnl_percent': round(t.pnl_percent, 2),
                'hold_time_minutes': round(t.hold_time_minutes, 2),
                'direction': t.direction
            }
            for t in trades
        ]
    }
    
    output_file = output_path / 'analyzed_trades.json'
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n✅ Results saved to: {output_file}")
    

if __name__ == '__main__':
    main()
