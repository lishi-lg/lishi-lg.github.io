import { db, auth } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginView.hidden = true;
    dashboardView.hidden = false;
    loadProfileIntoForm();
    loadProjectsList();
  } else {
    loginView.hidden = false;
    dashboardView.hidden = true;
  }
});

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");
  errorEl.hidden = true;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    errorEl.textContent = "No se pudo iniciar sesión: " + err.message;
    errorEl.hidden = false;
  }
});

document.getElementById("logout-btn").addEventListener("click", () => signOut(auth));

async function loadProfileIntoForm() {
  const snap = await getDoc(doc(db, "profile", "info"));
  if (!snap.exists()) return;
  const data = snap.data();
  document.getElementById("profile-name-input").value = data.name || "";
  document.getElementById("profile-tagline-input").value = data.tagline || "";
  document.getElementById("profile-bio-input").value = data.bio || "";
  document.getElementById("profile-photo-input").value = data.photoUrl || "";
  const links = data.links || {};
  document.getElementById("link-github").value = links.GitHub || "";
  document.getElementById("link-linkedin").value = links.LinkedIn || "";
  document.getElementById("link-email").value = links.Correo || "";
}

document.getElementById("profile-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const statusEl = document.getElementById("profile-status");
  statusEl.textContent = "Guardando…";

  try {
    await setDoc(doc(db, "profile", "info"), {
      name: document.getElementById("profile-name-input").value,
      tagline: document.getElementById("profile-tagline-input").value,
      bio: document.getElementById("profile-bio-input").value,
      photoUrl: document.getElementById("profile-photo-input").value,
      links: {
        GitHub: document.getElementById("link-github").value,
        LinkedIn: document.getElementById("link-linkedin").value,
        Correo: document.getElementById("link-email").value
      }
    });

    statusEl.textContent = "Perfil guardado ✓";
  } catch (err) {
    statusEl.textContent = "Error: " + err.message;
  }
});

document.getElementById("project-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const statusEl = document.getElementById("project-status");
  statusEl.textContent = "Guardando…";

  try {
    await addDoc(collection(db, "projects"), {
      title: document.getElementById("project-title").value,
      description: document.getElementById("project-description").value,
      link: document.getElementById("project-link").value,
      order: Number(document.getElementById("project-order").value) || 0,
      imageUrl: document.getElementById("project-image").value,
      createdAt: Date.now()
    });

    statusEl.textContent = "Proyecto agregado ✓";
    e.target.reset();
    loadProjectsList();
  } catch (err) {
    statusEl.textContent = "Error: " + err.message;
  }
});

async function loadProjectsList() {
  const listEl = document.getElementById("admin-projects-list");
  listEl.innerHTML = "";

  const q = query(collection(db, "projects"), orderBy("order", "asc"));
  const snap = await getDocs(q);

  snap.forEach((docSnap) => {
    const project = docSnap.data();
    const row = document.createElement("div");
    row.className = "admin-project-row";

    if (project.imageUrl) {
      const img = document.createElement("img");
      img.src = project.imageUrl;
      row.appendChild(img);
    }

    const info = document.createElement("div");
    info.className = "info";
    const title = document.createElement("h3");
    title.textContent = project.title || "";
    const desc = document.createElement("p");
    desc.textContent = project.description || "";
    info.appendChild(title);
    info.appendChild(desc);
    row.appendChild(info);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Eliminar";
    deleteBtn.addEventListener("click", async () => {
      if (!confirm(`¿Eliminar "${project.title}"?`)) return;
      await deleteDoc(doc(db, "projects", docSnap.id));
      loadProjectsList();
    });
    row.appendChild(deleteBtn);

    listEl.appendChild(row);
  });
}
