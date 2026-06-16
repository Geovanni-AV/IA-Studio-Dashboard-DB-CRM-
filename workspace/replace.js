import fs from 'fs';
let content = fs.readFileSync('src/components/LeadsSection.tsx', 'utf-8');
content = content.replace(/'Nuevo' \| 'Contactado' \| 'Cotizado' \| 'Negociación' \| 'Cerrado Ganado' \| 'Cerrado Perdido'/g, 'string');
fs.writeFileSync('src/components/LeadsSection.tsx', content);
