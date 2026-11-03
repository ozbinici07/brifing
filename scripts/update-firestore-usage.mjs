import {createRequire} from 'node:module';
import {collectUsage,firestoreFields} from './firestore-usage-core.mjs';
// Run on a trusted workstation with the project owner's existing Firebase CLI login.
// No personal refresh token is copied to GitHub or to the web application.
if(!process.argv.includes('--firebase-cli'))throw Error('Firebase CLI oturumuyla çalıştırın: npm run update:usage');
const require=createRequire(import.meta.url),auth=require('firebase-tools/lib/auth'),api=require('firebase-tools/lib/api');
api.setScopes(['https://www.googleapis.com/auth/cloud-platform']);const account=auth.getGlobalDefaultAccount();if(!account?.tokens?.refresh_token)throw Error('Önce yetkili hesapla firebase login komutunu çalıştırınız.');
const token=await auth.getAccessToken(account.tokens.refresh_token,api.getScopes()),project='brifingbilgisistemi';
async function request(url,options={}){const response=await fetch(url,{...options,signal:AbortSignal.timeout(30000),headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json',...(options.headers||{})}});const data=await response.json();if(!response.ok)throw Error((data.error?.message||'Kullanım verisi güncellenemedi.').slice(0,400));return data;}
const snapshot=await collectUsage({project,request});await request('https://firestore.googleapis.com/v1/projects/'+project+'/databases/(default)/documents/personnelSettings/firestoreUsage',{method:'PATCH',body:JSON.stringify(firestoreFields(snapshot).mapValue)});console.log('Yöneticiye özel günlük Firestore kullanım özeti güncellendi.');
