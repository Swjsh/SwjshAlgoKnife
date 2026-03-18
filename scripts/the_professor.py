"""
The Professor - Python Wrapper
Grades trades based on risk/reward and execution quality
"""

from datetime import datetime
import hashlib

class TheProfessor:
    
    @staticmethod
    def grade_trade(agent_name: str, trade_data: dict) -> dict:
        """
        Grade a trade based on execution quality
        
        Args:
            agent_name: Name of the agent (e.g., "Boba", "Pivot Pete")
            trade_data: {
                'ticker': str,
                'entry': float,
                'exit': float,
                'stop_loss': float,
                'type': 'DEMAND' | 'SUPPLY',
                'pnl': float,
                'duration_minutes': float
            }
        
        Returns:
            TradeReview dict with grade, critique, and action items
        """
        risk = abs(trade_data['entry'] - trade_data['stop_loss'])
        reward = abs(trade_data['exit'] - trade_data['entry'])
        rr = reward / risk if risk > 0 else 0
        is_win = trade_data['pnl'] > 0
        
        # Grading Rubric
        grade = 'C'
        critique = ''
        action_item = ''
        
        if is_win:
            if rr >= 2.0:
                grade = 'A'
                critique = f"Excellent execution. Risk/Reward was {rr:.2f}, exceeding the 2.0 gold standard."
                action_item = 'Continue holding specifically for 2R targets.'
            elif rr >= 1.0:
                grade = 'B'
                critique = f"Solid win, but profits were cut short. R/R was only {rr:.2f}."
                action_item = 'Review exit strategy. Did you panic sell?'
            else:
                grade = 'C+'
                critique = f"Green is green, but this was lucky. R/R was poor ({rr:.2f}). Sustainable trading requires better math."
                action_item = 'Do not take trades where target is less than 1.5R.'
        else:
            # Loss Logic
            if rr >= 2.0:  # Aimed for 2.0 but lost
                grade = 'B-'
                critique = "Good attempt. The structure was valid and R/R potential was there. Market just didn't agree today."
                action_item = 'No changes needed. Trust the probabilities.'
            elif trade_data['duration_minutes'] < 5:
                grade = 'F'
                critique = "Impulsive entry followed by immediate stop out? Smells like FOMO or trying to catch a falling knife."
                action_item = 'Mandatory 15-minute cool-down after distinct impulse moves.'
            else:
                grade = 'C-'
                critique = "Standard loss. Ensure stop placement wasn't too tight."
                action_item = 'Review 5m structure for safer stop placement.'
        
        # Specific Ticker Advice
        if 'BTC' in trade_data['ticker'] and trade_data['duration_minutes'] > 600:
            critique += ' (Note: Holding Crypto longer than 10h is risky due to volatility)'
        
        # Generate unique ID
        trade_id = hashlib.md5(f"{agent_name}{trade_data['ticker']}{datetime.now().isoformat()}".encode()).hexdigest()[:8]
        
        review = {
            'id': trade_id,
            'timestamp': datetime.now().isoformat(),
            'target_agent': agent_name,
            'grade': grade,
            'observation': f"{'Won' if is_win else 'Lost'} {trade_data['ticker']} trade (${trade_data['pnl']:.2f}).",
            'critique': critique,
            'action_item': action_item
        }
        
        return review
