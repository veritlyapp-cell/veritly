// Babel plugin: convierte `import { Check, Plus } from 'lucide-react-native'` en
// imports directos de cada icono (`lucide-react-native/dist/esm/icons/check.js`).
//
// Metro no hace tree-shaking, asi que el import desde el paquete raiz metia los
// ~1,650 iconos (1.3 MB) en el bundle web aunque la app usa unas decenas. El mapa
// nombre -> archivo sale del propio barrel del paquete, asi que incluye alias
// (ej. CheckCircle2 -> circle-check.js). Lo que no sea un icono (tipos,
// createLucideIcon, Icon) se deja en el import original.

const fs = require('fs');
const path = require('path');

let nameToFile = null;
function getNameToFile() {
    if (nameToFile) return nameToFile;
    nameToFile = {};
    const barrel = require.resolve('lucide-react-native/dist/esm/lucide-react-native.js');
    const src = fs.readFileSync(barrel, 'utf8');
    const re = /export \{([^}]+)\} from '\.\/icons\/([^']+)';/g;
    let m;
    while ((m = re.exec(src))) {
        const file = m[2];
        for (const part of m[1].split(',')) {
            const alias = part.trim().match(/^default as (\w+)$/);
            if (alias) nameToFile[alias[1]] = file;
        }
    }
    return nameToFile;
}

module.exports = function lucideDeepImports({ types: t }) {
    return {
        name: 'lucide-deep-imports',
        visitor: {
            ImportDeclaration(p) {
                if (p.node.source.value !== 'lucide-react-native') return;
                if (p.node.importKind === 'type') return;

                const map = getNameToFile();
                const deep = [];
                const keep = [];
                for (const spec of p.node.specifiers) {
                    const file = t.isImportSpecifier(spec) && spec.importKind !== 'type' && t.isIdentifier(spec.imported)
                        ? map[spec.imported.name]
                        : undefined;
                    if (file) {
                        deep.push(t.importDeclaration(
                            [t.importDefaultSpecifier(t.identifier(spec.local.name))],
                            t.stringLiteral(`lucide-react-native/dist/esm/icons/${file}`)
                        ));
                    } else {
                        keep.push(spec);
                    }
                }
                if (deep.length === 0) return;
                if (keep.length > 0) {
                    p.node.specifiers = keep;
                    p.insertAfter(deep);
                } else {
                    p.replaceWithMultiple(deep);
                }
            },
        },
    };
};
