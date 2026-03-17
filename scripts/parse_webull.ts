import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const BASE_DIR = 'C:\\Users\\jackw\\Desktop\\SwjshAlgoKnife\\docs\\WeBull History';
const OUTPUT_FILE = 'C:\\Users\\jackw\\Desktop\\SwjshAlgoKnife\\data\\parsed_trades.json';

interface RAWTrade {
    Name: string;
    Symbol: string;
    Side: string;
    Status: string;
    Filled: string;
    'Total Qty': string;
    Price: string;
    'Avg Price': string;
    'Time-in-Force': string;
    'Placed Time': string;
    'Filled Time': string;
}

interface ParsedTrade {
    contract: string;
    underlying: string;
    expiry: string;
    type: 'CALL' | 'PUT';
    strike: number;
    side: 'BUY' | 'SELL';
    status: string;
    filledQty: number;
    totalQty: number;
    price: number;
    avgPrice: number;
    placedTime: string;
    filledTime: string;
    year: number;
}

function parseOptionName(name: string): { underlying: string, expiry: string, type: 'CALL' | 'PUT', strike: number } | null {
    const len = name.length;
    if (len < 15) return null; // Too short for standard OSI

    const strikeStr = name.substring(len - 8);
    const typeStr = name.substring(len - 9, len - 8);
    const expiryStr = name.substring(len - 15, len - 9);
    const underlying = name.substring(0, len - 15);

    const strike = parseInt(strikeStr, 10) / 1000;
    const type = typeStr === 'C' ? 'CALL' : 'PUT' as const;

    // Format expiry YYMMDD to YYYY-MM-DD
    const year = '20' + expiryStr.substring(0, 2);
    const month = expiryStr.substring(2, 4);
    const day = expiryStr.substring(4, 6);
    const expiry = `${year}-${month}-${day}`;

    return { underlying, expiry, type, strike };
}

function cleanPrice(priceStr: string): number {
    if (!priceStr) return 0;
    const cleaned = priceStr.replace('@', '').trim();
    return parseFloat(cleaned) || 0;
}

function run() {
    const years = ['2021', '2022', '2023'];
    const allTrades: ParsedTrade[] = [];

    for (const year of years) {
        const filePath = path.join(BASE_DIR, year, 'Webull_Orders_Records_Options.csv');
        if (!fs.existsSync(filePath)) {
            console.warn(`File not found: ${filePath}`);
            continue;
        }

        console.log(`Parsing ${year} data...`);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const records: RAWTrade[] = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });

        for (const record of records) {
            if (record.Status !== 'Filled') continue;

            const optionInfo = parseOptionName(record.Name);
            if (!optionInfo) {
                console.warn(`Could not parse option name: ${record.Name}`);
                continue;
            }

            allTrades.push({
                contract: record.Name,
                ...optionInfo,
                side: record.Side.toUpperCase() as 'BUY' | 'SELL',
                status: record.Status,
                filledQty: parseInt(record.Filled, 10),
                totalQty: parseInt(record['Total Qty'], 10),
                price: cleanPrice(record.Price),
                avgPrice: cleanPrice(record['Avg Price']),
                placedTime: record['Placed Time'],
                filledTime: record['Filled Time'],
                year: parseInt(year, 10)
            });
        }
    }

    // Ensure data directory exists
    const dataDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allTrades, null, 2));
    console.log(`Successfully parsed ${allTrades.length} trades. Saved to ${OUTPUT_FILE}`);
}

run();
