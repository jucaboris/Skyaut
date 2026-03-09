// Arquivo: db.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, ref, push, onValue, onChildAdded, set, remove } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

// Configuração oficial do projeto Plane 2026
const firebaseConfig = {
  apiKey: "AIzaSyB4wLn89l7vHd8ZBuO0_xyMGLVpUQo3Dm0",
  authDomain: "plane-2026.firebaseapp.com",
  databaseURL: "https://plane-2026-default-rtdb.firebaseio.com",
  projectId: "plane-2026",
  storageBucket: "plane-2026.firebasestorage.app",
  messagingSenderId: "517130848502",
  appId: "1:517130848502:web:7a2b5bdd139549be3444d7"
};

// Inicializa o Firebase e o Banco de Dados em Tempo Real
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

// Exporta as ferramentas para o ui.js poder ler e gravar
export { ref, push, onValue, onChildAdded, set, remove };
