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

// Los enlaces del perfil (github, correo...) también sirven en los textos de los tutoriales
let enlacesPerfil = {};

async function loadProfile() {
  const snap = await getDoc(doc(db, "profile", "info"));
  if (!snap.exists()) return {};

  const data = snap.data();
  if (data.name) document.getElementById("profile-name").textContent = data.name;
  const links = data.links || {};
  enlacesPerfil = links;
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

// ================== TUTORIALES ==================
// Modelo: categorías (tut_categories) > tutoriales (tut_tutorials) > capítulos (tut_chapters).
// La página de una categoría lleva dos cuadros combinados y UN reproductor:
// eliges tutorial, eliges capítulo, y con el botón Ir (o Enter) se carga el audio bajo demanda.
const selTutorial = document.getElementById("sel-tutorial");
const selCapitulo = document.getElementById("sel-capitulo");
const player = document.getElementById("tut-player");
const tutEstado = document.getElementById("tut-estado");
let catActual = null;
let capitulosPorTutorial = {};

async function loadCategorias() {
  const grid = document.getElementById("tut-grid");
  const q = query(collection(db, "tut_categories"), orderBy("order", "asc"));
  const snap = await getDocs(q);

  if (snap.empty) {
    document.getElementById("tut-empty").hidden = false;
    return;
  }

  snap.forEach((docSnap) => {
    const c = docSnap.data();
    const card = document.createElement("article");
    card.className = "project-card";
    const body = document.createElement("div");
    body.className = "project-card-body";
    const title = document.createElement("h3");
    const link = document.createElement("a");
    link.href = "#tutorial/" + docSnap.id;
    link.textContent = c.title || "";
    title.appendChild(link);
    body.appendChild(title);
    if (c.intro) {
      const desc = document.createElement("p");
      pintarTexto(desc, c.intro, enlacesPerfil, { parrafos: false });
      body.appendChild(desc);
    }
    card.appendChild(body);
    grid.appendChild(card);
  });
}

function llenarCapitulos(tutorialId) {
  const caps = capitulosPorTutorial[tutorialId] || [];
  selCapitulo.replaceChildren(...caps.map((d) => {
    const o = document.createElement("option");
    o.value = d.id;
    o.textContent = d.data().title || "";
    return o;
  }));
}

async function abrirCategoria(id) {
  catActual = id;
  tutEstado.textContent = "Cargando…";
  try {
    const snap = await getDoc(doc(db, "tut_categories", id));
    if (!snap.exists()) {
      tutEstado.textContent = "No se encontró esta página de tutoriales.";
      return;
    }
    const c = snap.data();
    document.getElementById("cat-titulo").textContent = "Tutoriales de " + (c.title || "");
    document.title = "Tutoriales de " + (c.title || "") + " — " + TITULO_SITIO;
    pintarTexto(document.getElementById("cat-intro"), c.intro || "", enlacesPerfil);
    const aviso = document.getElementById("cat-aviso");
    aviso.hidden = !c.aviso;
    aviso.textContent = c.aviso || "";

    // traigo los tutoriales y los capítulos de una vez (son pocos) y los reparto por tutorial
    const [snapTut, snapCap] = await Promise.all([
      getDocs(query(collection(db, "tut_tutorials"), orderBy("order", "asc"))),
      getDocs(query(collection(db, "tut_chapters"), orderBy("order", "asc")))
    ]);
    const tutoriales = snapTut.docs.filter((d) => d.data().categoryId === id);
    capitulosPorTutorial = {};
    snapCap.docs.forEach((d) => {
      const t = d.data().tutorialId;
      (capitulosPorTutorial[t] = capitulosPorTutorial[t] || []).push(d);
    });

    selTutorial.replaceChildren(...tutoriales.map((d) => {
      const o = document.createElement("option");
      o.value = d.id;
      o.textContent = d.data().title || "";
      return o;
    }));
    llenarCapitulos(selTutorial.value);
    tutEstado.textContent = tutoriales.length ? "" : "Esta página todavía no tiene tutoriales.";
  } catch (err) {
    console.error("Error cargando tutoriales:", err);
    tutEstado.textContent = "No se pudieron cargar los tutoriales. Inténtalo de nuevo en un rato.";
  }
}

selTutorial.addEventListener("change", () => llenarCapitulos(selTutorial.value));

// El botón Ir (o Enter en el formulario) carga el capítulo elegido en el reproductor
document.getElementById("tut-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const opt = selCapitulo.selectedOptions[0];
  const cap = opt && (capitulosPorTutorial[selTutorial.value] || []).find((d) => d.id === opt.value);
  if (!cap || !cap.data().audioUrl) {
    tutEstado.textContent = "Este capítulo todavía no tiene audio. Elige otro o vuelve en unos días.";
    return;
  }
  player.src = cap.data().audioUrl;
  player.load();
  tutEstado.textContent = "Capítulo cargado: " + (cap.data().title || "") + ". Dale a reproducir en el reproductor.";
  player.focus();
});

// ================== CARGA INICIAL ==================
// primero el perfil, porque los textos de proyectos y tutoriales pueden usar sus enlaces (github, correo...)
loadProfile()
  .catch((err) => { console.error("Error cargando perfil:", err); return {}; })
  .then((links) => Promise.all([
    loadProjects(links).catch((err) => console.error("Error cargando proyectos:", err)),
    loadCategorias().catch((err) => console.error("Error cargando tutoriales:", err))
  ]))
  .catch((err) => console.error(err));

// ================== MENÚ Y SECCIONES ==================
// Solo se ve una sección a la vez: portada, Mis proyectos, Mis tutoriales, una página de tutoriales o Sobre mí.
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
  // la página de una categoría de tutoriales usa la dirección #tutorial/<su id>
  const partes = location.hash.slice(1).split("/");
  const id = partes[0];
  const param = partes[1] || "";
  let vista = vistas.find((v) => v.id === id) || vistas[0];
  if (vista.id === "tutorial" && !param) vista = document.getElementById("tutoriales");
  vistas.forEach((v) => (v.hidden = v !== vista));
  menuLista.querySelectorAll("a").forEach((a) => {
    const destino = a.getAttribute("href") === "#" + vista.id ||
      (vista.id === "tutorial" && a.getAttribute("href") === "#tutoriales");
    if (destino) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  const titulo = vista.querySelector("h1, h2");
  if (vista.id !== "tutorial") {
    document.title = vista === vistas[0] ? TITULO_SITIO : titulo.textContent + " — " + TITULO_SITIO;
  }
  abrirMenu(false);
  window.scrollTo(0, 0);
  if (vista.id === "tutorial" && param && param !== catActual) abrirCategoria(param);
  // al cambiar de sección, el lector empieza a leer desde su título
  if (moverFoco) titulo.focus();
}

window.addEventListener("hashchange", () => mostrarVista(true));
mostrarVista(false);
