
import { SandboxRunner } from '../src/testing/sandbox';
import path from 'path';

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.error('Usage: ts-node scripts/verify_extension.ts <path-to-extension>');
        process.exit(1);
    }

    const extPath = path.resolve(process.cwd(), args[0]!);
    console.log(`Verifying extension at: ${extPath}`);

    const result = await SandboxRunner.validateExtension(extPath);

    if (result.success) {
        console.log('✅ Extension Verification Passed!');
        console.log('Logs:', result.logs);
        process.exit(0);
    } else {
        console.error('❌ Extension Verification Failed.');
        console.error('Error:', result.error);
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
