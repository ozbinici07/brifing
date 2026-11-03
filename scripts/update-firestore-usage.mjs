import {createRequire} from 'node:module';
import {collectUsage,firestoreFields} from './firestore-usage-core.mjs';
// Credentials are provided by the trusted workstation or the GitHub runner, never the browser.
const require=createRequire(import.meta.url),project='brifingbilgisistemi';
let accessToken;
if(process.argv.includes('--firebase-cli')){
 const auth=require('firebase-tools/lib/auth'),api=require('firebase-tools/lib/api');api.setScopes(['https://www.googleapis.com/auth/cloud-platform']);
 const account=auth.getGlobalDefaultAccount();if(!account?.tokens?.refresh_token)throw Error('Önce yetkili hesapla firebase login komutunu çalıştırınız.');
 accessToken=(await auth.getAccessToken(account.tokens.refresh_token,api.getScopes())).access_token;
}else if(process.argv.includes('--application-default')){
 const {GoogleAuth}=require('google-auth-library'),auth=new GoogleAuth({scopes:['https://www.googleapis.com/auth/cloud-platform']});
 accessToken=await auth.getAccessToken();if(!accessToken)throw Error('Otomatik kullanım özeti hesabı doğrulanamadı.');
}else throw Error('Yetkili oturum seçiniz: --firebase-cli veya --application-default');
async function request(url,options={}){const response=await fetch(url,{...options,signal:AbortSignal.timeout(30000),headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json',...(options.headers||{})}});const data=await response.json();if(!response.ok)throw Error((data.error?.message||'Kullanım verisi güncellenemedi.').slice(0,400));return data;}
const snapshot=await collectUsage({project,request});await request('https://firestore.googleapis.com/v1/projects/'+project+'/databases/(default)/documents/personnelSettings/firestoreUsage',{method:'PATCH',body:JSON.stringify(firestoreFields(snapshot).mapValue)});console.log('Yöneticiye özel günlük Firestore kullanım özeti güncellendi.');
