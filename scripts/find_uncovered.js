import fs from 'fs';
import path from 'path';

const coverageFile = path.resolve('coverage/coverage-final.json');
if (!fs.existsSync(coverageFile)) {
  console.error('No coverage-final.json found');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));

for (const [file, info] of Object.entries(data)) {
  const relPath = path.relative(process.cwd(), file);
  if (relPath.includes('__tests__') || relPath.includes('setupTests')) {
    continue;
  }
  
  console.log(`\n=== Uncovered lines for: ${relPath} ===`);
  const statementMap = info.statementMap;
  const s = info.s;
  
  const uncoveredLines = new Set();
  for (const [key, count] of Object.entries(s)) {
    if (count === 0) {
      const loc = statementMap[key];
      for (let line = loc.start.line; line <= loc.end.line; line++) {
        uncoveredLines.add(line);
      }
    }
  }
  
  const sortedLines = Array.from(uncoveredLines).sort((a, b) => a - b);
  if (sortedLines.length === 0) {
    console.log('No uncovered lines.');
    continue;
  }
  
  // Group into ranges
  const ranges = [];
  let rangeStart = sortedLines[0];
  let prev = sortedLines[0];
  
  for (let i = 1; i < sortedLines.length; i++) {
    const current = sortedLines[i];
    if (current === prev + 1) {
      prev = current;
    } else {
      if (rangeStart === prev) {
        ranges.push(`${rangeStart}`);
      } else {
        ranges.push(`${rangeStart}-${prev}`);
      }
      rangeStart = current;
      prev = current;
    }
  }
  if (rangeStart === prev) {
    ranges.push(`${rangeStart}`);
  } else {
    ranges.push(`${rangeStart}-${prev}`);
  }
  
  console.log('Lines:', ranges.join(', '));
}
