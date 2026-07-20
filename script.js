// 1. ВСТАВЬ СЮДА СВОЙ КОД ИЗ FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyD6JQPUxDIgoKoYKRdlx20UAo7RjHQSzro",
  authDomain: "burhlin--gnomes-database.firebaseapp.com",
  projectId: "burhlin--gnomes-database",
  storageBucket: "burhlin--gnomes-database.firebasestorage.app",
  messagingSenderId: "184546558617",
  appId: "1:184546558617:web:455f2a7a8d7215ec486e08",
  measurementId: "G-Q6QWS27Y1Z"
};

// Запуск Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// 2. Регистрация
function register() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value;

    if (!username) { alert("Введи никнейм!"); return; }

    auth.createUserWithEmailAndPassword(email, password)
    .then((cred) => {
        return db.collection('users').doc(cred.user.uid).set({
            username: username,
            role: (username === 'Antropomeda') ? 'admin' : 'player'
        });
    })
    .then(() => alert("Успешная регистрация!"))
    .catch((error) => alert("Ошибка: " + error.message));
}

// 3. Вход
function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    auth.signInWithEmailAndPassword(email, password)
    .catch((error) => alert("Ошибка: " + error.message));
}

// 4. Выход
function logout() { auth.signOut(); }

// 5. Открытие меню мода
function toggleModMenu() {
    const menu = document.getElementById('mod-menu');
    menu.style.display = (menu.style.display === "none") ? "block" : "none";
}

// 6. Проверка: вошел ли игрок (и Админ ли он)
auth.onAuthStateChanged((user) => {
    if (user) {
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';

        db.collection('users').doc(user.uid).get().then((doc) => {
            if (doc.exists) {
                const userData = doc.data();
                document.getElementById('user-greeting').innerText = `Привет, ${userData.username}!`;
                
                if (userData.role === 'admin') {
                    document.getElementById('admin-panel').style.display = 'block';
                }
            }
        });
    } else {
        document.getElementById('auth-section').style.display = 'block';
        document.getElementById('main-content').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'none';
    }
});