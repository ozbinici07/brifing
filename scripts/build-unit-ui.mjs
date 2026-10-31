import {build} from 'esbuild';
await build({entryPoints:['source/units/panel.tsx'],outfile:'units/app.js',bundle:true,minify:true,format:'iife',platform:'browser',target:['chrome100','edge100'],define:{'process.env.NODE_ENV':'"production"'}});
