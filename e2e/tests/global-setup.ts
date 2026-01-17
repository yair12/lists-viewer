import { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import * as path from 'path';

async function globalSetup(config: FullConfig) {
  console.log('\n🚀 Starting E2E test environment...\n');

  try {
    const composeFile = path.join(__dirname, '../docker-compose.test.yml');
    
    // Stop any existing containers
    console.log('🧹 Cleaning up existing containers...');
    try {
      execSync(`docker compose -f ${composeFile} down -v`, { stdio: 'inherit' });
    } catch (e) {
      // Ignore if nothing to clean up
    }

    // Start services
    console.log('🚀 Starting services with docker compose...');
    execSync(`docker compose -f ${composeFile} up -d --build`, { stdio: 'inherit' });

    // Wait for services to be healthy
    console.log('⏳ Waiting for services to be healthy...');
    let retries = 0;
    const maxRetries = 30;
    
    while (retries < maxRetries) {
      try {
        const output = execSync(`docker compose -f ${composeFile} ps --format json`, { encoding: 'utf-8' });
        const services = output.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
        
        const allHealthy = services.every(service => 
          service.Health === 'healthy' || service.State === 'running'
        );
        
        if (allHealthy && services.length === 2) {
          console.log('✅ All services are healthy');
          break;
        }
      } catch (e) {
        // Continue waiting
      }
      
      retries++;
      if (retries >= maxRetries) {
        throw new Error('Services did not become healthy in time');
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const serverUrl = 'http://localhost:8080';
    console.log(`✅ Server available at: ${serverUrl}`);

    // Store server URL for tests
    process.env.SERVER_URL = serverUrl;

    // Verify server health
    console.log('⏳ Verifying server health...');
    const healthResponse = await fetch(`${serverUrl}/api/v1/health`);
    if (!healthResponse.ok) {
      throw new Error(`Server health check failed: ${healthResponse.status}`);
    }
    console.log('✅ Server is healthy');

    console.log('\n✅ E2E environment ready!\n');
  } catch (error) {
    console.error('❌ Failed to start E2E environment:', error);
    
    // Show logs on failure
    try {
      const composeFile = path.join(__dirname, '../docker-compose.test.yml');
      console.log('\n📋 Service logs:');
      execSync(`docker compose -f ${composeFile} logs`, { stdio: 'inherit' });
    } catch (e) {
      // Ignore
    }
    
    throw error;
  }
}

export default globalSetup;
