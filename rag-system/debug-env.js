require('dotenv').config({ path: '../.env' });

console.log('🔍 Environment Variable Debug:');
console.log('='.repeat(50));

console.log('Neo4j Variables:');
console.log('NEO4J_URI:', process.env.NEO4J_URI);
console.log('NEO4J_USER:', process.env.NEO4J_USER);
console.log('NEO4J_USERNAME:', process.env.NEO4J_USERNAME);
console.log('NEO4J_PASSWORD:', process.env.NEO4J_PASSWORD ? '[HIDDEN]' : 'NOT SET');

console.log('\nSystem Variables:');
console.log('HOME:', process.env.HOME);
console.log('LOGNAME:', process.env.LOGNAME);
console.log('USER:', process.env.USER);
console.log('NODE_ENV:', process.env.NODE_ENV);

console.log('\nAll Neo4j related env vars:');
Object.keys(process.env)
  .filter(key => key.includes('NEO4J'))
  .forEach(key => {
    console.log(`${key}:`, key.includes('PASSWORD') ? '[HIDDEN]' : process.env[key]);
  });

console.log('\nDotenv file path check:');
const fs = require('fs');
const path = require('path');
const envPath = path.resolve('../.env');
console.log('Looking for .env at:', envPath);
console.log('File exists:', fs.existsSync(envPath));

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  console.log('First few lines of .env:');
  console.log(envContent.split('\n').slice(0, 5).join('\n'));
}
