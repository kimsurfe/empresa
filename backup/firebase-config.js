// firebase-config.js
/* 
  Configuração do Firebase usando a versão Compat para suportar a 
  abertura do arquivo localmente (file://) sem servidor.
*/

const firebaseConfig = {
    apiKey: "AIzaSyDRxqZN9WyUgsVsq3S1-mO-oavB-5LiMvA",
    authDomain: "lembretes-4eac5.firebaseapp.com",
    projectId: "lembretes-4eac5",
    storageBucket: "lembretes-4eac5.firebasestorage.app",
    messagingSenderId: "1027430229292",
    appId: "1:1027430229292:web:d45c014ea55f027fc5f889"
};

// Variáveis globais no window
window.firebaseApp = firebase.initializeApp(firebaseConfig);
window.db = firebase.firestore();
