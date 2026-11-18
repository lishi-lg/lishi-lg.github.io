import { db } from "./firebase-config.js";
import { pintarTexto } from "./texto.js";
import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

document.getElementById("year").textContent = new Date().getFullYear();

async function loadProfile() {
  const snap = await getDoc(doc(db, "profile", "info"));
  if (!snap.exists()) return {};

  const data = snap.data();
  if (data.name) document.getElementById("profile-name").textContent = data.name;
  const links = data.links || {};
  // la frase de bienvenida y el "Sobre mí" pueden llevar enlaces dentro del texto
  const enFrase = pintarTexto(document.getElementById("profile-tagline"), data.tagline || "", links, { parrafos: false });
  const enBio = pintarTexto(document.getElementById("profile-bio"), data.bio || "", links);

  if (data.photoUrl) {
    const img = document.getElementById("profile-photo");
    img.src = data.photoUrl;
    img.hidden = false;
  }

  const linksEl = document.getElementById("profile-links");
  Object.entries(links).forEach(([label, url]) => {
    // si el enlace ya sale dentro del texto, no se repite abajo
    if (!url || enFrase.usados.has(label) || enBio.usados.has(label)) return;
    const a = document.createElement("a");
    a.href = label === "Correo" && !url.startsWith("mailto:") ? "mailto:" + url : url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = label;
    linksEl.appendChild(a);
  });
  return links;
}

function createProjectCard(project, links) {
  const card = document.createElement("article");
  card.className = "project-card";

  if (project.imageUrl) {
    const img = document.createElement("img");
    img.src = project.imageUrl;
    img.alt = ""; // el título ya dice qué proyecto es
    card.appendChild(img);
  }

  const body = document.createElement("div");
  body.className = "project-card-body";

  // si el proyecto tiene enlace, el propio título es el enlace
  const title = document.createElement("h3");
  if (project.link) {
    const link = document.createElement("a");
    link.href = project.link;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = project.title || project.link;
    title.appendChild(link);
  } else {
    title.textContent = project.title || "";
  }
  body.appendChild(title);

  const desc = document.createElement("p");
  pintarTexto(desc, project.description || "", links, { parrafos: false });
  body.appendChild(desc);

  card.appendChild(body);
  return card;
}

async function loadProjects(links) {
  const grid = document.getElementById("projects-grid");
  const q = query(collection(db, "projects"), orderBy("order", "asc"));
  const snap = await getDocs(q);

  if (snap.empty) {
    document.getElementById("projects-empty").hidden = false;
    return;
  }

  snap.forEach((docSnap) => {
    grid.appendChild(createProjectCard(docSnap.data(), links));
  });
}

// primero el perfil, porque los textos de los proyectos pueden usar sus enlaces (github, correo...)
loadProfile()
  .catch((err) => { console.error("Error cargando perfil:", err); return {}; })
  .then((links) => loadProjects(links))
  .catch((err) => console.error("Error cargando proyectos:", err));

// ================== MENÚ Y SECCIONES ==================
// Solo se ve una sección a la vez: la portada, Mis proyectos o Sobre mí.
const menuBtn = document.getElementById("menu-btn");
const menuLista = document.getElementById("menu-lista");
const vistas = [...document.querySelectorAll(".vista")];
const TITULO_SITIO = document.title;

function abrirMenu(abrir) {
  menuLista.hidden = !abrir;
  menuBtn.setAttribute("aria-expanded", String(abrir));
}

menuBtn.addEventListener("click", () => {
  const abrir = menuLista.hidden;
  abrirMenu(abrir);
  if (abrir) menuLista.querySelector("a").focus();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !menuLista.hidden) {
    abrirMenu(false);
    menuBtn.focus();
  }
});

document.addEventListener("click", (e) => {
  if (!menuLista.hidden && !e.target.closest(".nav")) abrirMenu(false);
});

function mostrarVista(moverFoco) {
  const id = location.hash.slice(1);
  const vista = vistas.find((v) => v.id === id) || vistas[0];
  vistas.forEach((v) => (v.hidden = v !== vista));
  menuLista.querySelectorAll("a").forEach((a) => {
    if (a.getAttribute("href") === "#" + vista.id) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  const titulo = vista.querySelector("h1, h2");
  document.title = vista === vistas[0] ? TITULO_SITIO : titulo.textContent + " — " + TITULO_SITIO;
  abrirMenu(false);
  window.scrollTo(0, 0);
  // al cambiar de sección, el lector empieza a leer desde su título
  if (moverFoco) titulo.focus();
}

window.addEventListener("hashchange", () => mostrarVista(true));
mostrarVista(false);
