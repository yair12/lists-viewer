import { execSync } from 'child_process';
import * as path from 'path';

async function globalTeardown() {
  console.log('\n🧹 Cleaning up E2E test environment...\n');

  try {
    const composeFile = path.join(__dirname, '../docker-compose.test.yml');
    
    console.log('🛑 Stopping docker compose services...');
    execSync(`docker compose -f ${composeFile} down -v`, { stdio: 'inherit' });
    
    console.log('\n✅ E2E environment cleaned up\n');
  } catch (error) {
    console.error('❌ Error during teardown:', error);
    // Don't throw - allow tests to complete even if cleanup fails
  }
}

export default globalTeardown;
