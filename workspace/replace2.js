import fs from 'fs';
let content = fs.readFileSync('src/components/LeadsSection.tsx', 'utf-8');

// Replace COLUMNS string literal array
const regexColumns = /const COLUMNS: string\[\] = \[\n\s+'Nuevo', 'Contactado', 'Cotizado', 'Negociación', 'Cerrado Ganado', 'Cerrado Perdido'\n\s+\];/g;
content = content.replace(regexColumns, '');
fs.writeFileSync('src/components/LeadsSection.tsx', content);
