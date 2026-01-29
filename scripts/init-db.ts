
import { initDB } from '../src/lib/db';

console.log('Initializing Database...');
try {
    initDB();
    console.log('Success!');
} catch (error) {
    console.error('Failed to initialize DB:', error);
}
