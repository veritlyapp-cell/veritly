// Punto de entrada de la app (package.json "main").
//
// Equivale a usar "expo-router/entry" directo; existe como archivo propio para
// que el bundle entry-<hash>.js cambie de nombre. Entre el 30/09/2026 04:51 y
// 12:30 UTC ese archivo se sirvio con cache "immutable" (ver netlify.toml) y
// los navegadores que lo guardaron seguian usando un mapa de chunks viejo.
import 'expo-router/entry';
