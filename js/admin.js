import { db, auth } from "./firebase-config.js";
import { pintarTexto } from "./texto.js";
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
  updateDoc,
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
  actualizarVista();
}

// Vista previa de la frase y del "Sobre mí", tal como saldrán en la portada
function enlacesDelFormulario() {
  return {
    GitHub: document.getElementById("link-github").value,
    LinkedIn: document.getElementById("link-linkedin").value,
    Correo: document.getElementById("link-email").value
  };
}

function actualizarVista() {
  const links = enlacesDelFormulario();
  const a = pintarTexto(document.getElementById("vista-frase"), document.getElementById("profile-tagline-input").value, links, { parrafos: false });
  const b = pintarTexto(document.getElementById("vista-bio"), document.getElementById("profile-bio-input").value, links);
  const problemas = [...a.problemas, ...b.problemas];
  const aviso = document.getElementById("vista-avisos");
  aviso.hidden = !problemas.length;
  aviso.textContent = problemas.length
    ? "Estos enlaces no funcionan y saldrán como texto normal: " + problemas.join(", ") +
      ". Revisa lo que hay entre paréntesis, o rellena el enlace en el apartado Enlaces."
    : "";
}

["profile-tagline-input", "profile-bio-input", "link-github", "link-linkedin", "link-email"].forEach((id) =>
  document.getElementById(id).addEventListener("input", actualizarVista)
);

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

// El mismo formulario sirve para agregar un proyecto o para editar uno existente
const projectForm = document.getElementById("project-form");
let editandoId = null;

function empezarEdicion(id, project) {
  editandoId = id;
  document.getElementById("project-title").value = project.title || "";
  document.getElementById("project-description").value = project.description || "";
  document.getElementById("project-link").value = project.link || "";
  document.getElementById("project-order").value = project.order ?? 0;
  document.getElementById("project-image").value = project.imageUrl || "";
  document.getElementById("project-form-title").textContent = "Editar proyecto: " + (project.title || "");
  document.getElementById("project-submit").textContent = "Guardar cambios";
  document.getElementById("project-cancel").hidden = false;
  document.getElementById("project-status").textContent = "";
  projectForm.scrollIntoView({ block: "center" });
  document.getElementById("project-title").focus();
}

function terminarEdicion() {
  editandoId = null;
  projectForm.reset();
  document.getElementById("project-form-title").textContent = "Agregar proyecto";
  document.getElementById("project-submit").textContent = "Agregar";
  document.getElementById("project-cancel").hidden = true;
}

document.getElementById("project-cancel").addEventListener("click", () => {
  terminarEdicion();
  document.getElementById("project-status").textContent = "Edición cancelada.";
  document.getElementById("project-title").focus();
});

projectForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const statusEl = document.getElementById("project-status");
  statusEl.textContent = "Guardando…";

  const datos = {
    title: document.getElementById("project-title").value,
    description: document.getElementById("project-description").value,
    link: document.getElementById("project-link").value,
    order: Number(document.getElementById("project-order").value) || 0,
    imageUrl: document.getElementById("project-image").value
  };

  try {
    if (editandoId) {
      await updateDoc(doc(db, "projects", editandoId), datos);
      statusEl.textContent = "Cambios guardados ✓";
    } else {
      await addDoc(collection(db, "projects"), { ...datos, createdAt: Date.now() });
      statusEl.textContent = "Proyecto agregado ✓";
    }
    terminarEdicion();
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
    pintarTexto(desc, project.description || "", enlacesDelFormulario(), { parrafos: false });
    info.appendChild(title);
    info.appendChild(desc);
    row.appendChild(info);

    const editBtn = document.createElement("button");
    editBtn.textContent = "Editar";
    editBtn.className = "btn-editar";
    editBtn.setAttribute("aria-label", "Editar " + (project.title || "proyecto"));
    editBtn.addEventListener("click", () => empezarEdicion(docSnap.id, project));
    row.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Eliminar";
    deleteBtn.className = "btn-eliminar";
    deleteBtn.setAttribute("aria-label", "Eliminar " + (project.title || "proyecto"));
    deleteBtn.addEventListener("click", async () => {
      if (!confirm(`¿Eliminar "${project.title}"?`)) return;
      await deleteDoc(doc(db, "projects", docSnap.id));
      if (editandoId === docSnap.id) terminarEdicion();
      loadProjectsList();
    });
    row.appendChild(deleteBtn);

    listEl.appendChild(row);
  });
}
