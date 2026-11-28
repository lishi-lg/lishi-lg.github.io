import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { pintarTexto } from "./texto.js";
import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  getDocs,
  where,
  addDoc,
  serverTimestamp,
  setDoc,
  increment
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
  const docsProy = (await leerColeccion("projects")).filter(esVisible);

  if (!docsProy.length) {
    document.getElementById("projects-empty").hidden = false;
    return;
  }

  docsProy.forEach((docSnap) => {
    const proyecto = docSnap.data();
    if (VISTA_PREVIA && proyecto.oculto) proyecto.title = (proyecto.title || proyecto.link || "") + " (oculto)";
    grid.appendChild(createProjectCard(proyecto, links));
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
// descripción del tutorial elegido: sale justo debajo del cuadro "¿Qué tutorial?" y el lector la anuncia al cambiar
const tutDesc = document.createElement("p");
tutDesc.id = "tut-desc";
tutDesc.setAttribute("aria-live", "polite");
tutDesc.hidden = true;
selTutorial.after(tutDesc);
let descripcionesTutorial = {};
function mostrarDescripcionTutorial(id) {
  const texto = descripcionesTutorial[id] || "";
  tutDesc.hidden = !texto;
  pintarTexto(tutDesc, texto, enlacesPerfil, { parrafos: false });
}
// Borradores: lo que lleva "oculto" no lo ve el público. Con ?vista=1 y la sesión del panel abierta en este navegador, Leslie lo ve todo.
const PIDE_VISTA = new URLSearchParams(location.search).has("vista");
let VISTA_PREVIA = false;
if (PIDE_VISTA) {
  // si no hay sesión (o el navegador tarda en decirlo), la página sale como la ve el público, nunca vacía
  VISTA_PREVIA = await new Promise((resolve) => {
    const plazo = setTimeout(() => resolve(false), 4000);
    const dejarDeEscuchar = onAuthStateChanged(auth, (usuario) => { clearTimeout(plazo); dejarDeEscuchar(); resolve(!!usuario); }, () => { clearTimeout(plazo); resolve(false); });
  });
  const avisoVista = document.createElement("p");
  avisoVista.id = "vista-aviso";
  avisoVista.className = "status-msg";
  avisoVista.setAttribute("role", "status");
  document.getElementById("contenido").before(avisoVista);
  setTimeout(() => {
    avisoVista.textContent = VISTA_PREVIA
      ? "Vista previa: estás viendo también los borradores, es decir, lo que está oculto y las categorías o tutoriales vacíos. Los visitantes normales no lo ven."
      : "Ahora ves la página igual que cualquier visitante. Para ver también los borradores, abre antes el panel de administración (admin.html) en este mismo navegador, entra con tu correo y contraseña, y vuelve a abrir esta dirección.";
  }, 600);
}
const esVisible = (d) => VISTA_PREVIA || !d.data().oculto;
const marcaOculto = (d) => (VISTA_PREVIA && d.data().oculto ? " (oculto)" : "");
// el público pide solo lo no oculto (así lo exigen las reglas); con sesión y vista previa, todo
async function leerColeccion(nombre) {
  const col = collection(db, nombre);
  const publica = () => getDocs(query(col, where("oculto", "==", false)));
  let snap;
  if (VISTA_PREVIA) {
    try {
      snap = await getDocs(query(col, orderBy("order", "asc")));
    } catch (err) {
      // sesión caducada o sin permiso: se cae a lo público en vez de dejar la página vacía
      console.error("Vista previa sin permiso, se muestra lo público:", err);
      VISTA_PREVIA = false;
      snap = await publica();
    }
  } else {
    snap = await publica();
  }
  return snap.docs.slice().sort((a, b) => (a.data().order || 0) - (b.data().order || 0));
}
// tutoriales (con al menos un capítulo visible) y capítulos visibles; en vista previa, todo
async function cargarArbol() {
  const [todosTut, todosCap] = await Promise.all([leerColeccion("tut_tutorials"), leerColeccion("tut_chapters")]);
  const caps = todosCap.filter(esVisible);
  const tuts = todosTut.filter(esVisible).filter((t) => VISTA_PREVIA || caps.some((c) => c.data().tutorialId === t.id));
  return { tuts, caps };
}

let catActual = null;
let capitulosPorTutorial = {};

async function loadCategorias() {
  const grid = document.getElementById("tut-grid");
  const [todasCats, arbol] = await Promise.all([leerColeccion("tut_categories"), cargarArbol()]);
  const docsCats = todasCats.filter(esVisible).filter((d) => VISTA_PREVIA || arbol.tuts.some((t) => t.data().categoryId === d.id));

  if (!docsCats.length) {
    document.getElementById("tut-empty").hidden = false;
    return;
  }

  docsCats.forEach((docSnap) => {
    const c = docSnap.data();
    const card = document.createElement("article");
    card.className = "project-card";
    const body = document.createElement("div");
    body.className = "project-card-body";
    const title = document.createElement("h3");
    const link = document.createElement("a");
    link.href = "#tutorial/" + docSnap.id;
    link.textContent = (c.title || "") + marcaOculto(docSnap);
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
    o.textContent = (d.data().title || "") + marcaOculto(d);
    return o;
  }));
}

async function abrirCategoria(id) {
  catActual = id;
  ocultarOpinion();
  tutEstado.textContent = "Cargando…";
  try {
    const snap = await getDoc(doc(db, "tut_categories", id));
    if (!snap.exists() || (!VISTA_PREVIA && snap.data().oculto)) {
      tutEstado.textContent = "No se encontró esta página de tutoriales.";
      return;
    }
    const c = snap.data();
    const arbol = await cargarArbol();
    const tutoriales = arbol.tuts.filter((d) => d.data().categoryId === id);
    if (!VISTA_PREVIA && !tutoriales.length) {
      tutEstado.textContent = "No se encontró esta página de tutoriales.";
      return;
    }
    document.getElementById("cat-titulo").textContent = "Tutoriales de " + (c.title || "");
    document.title = "Tutoriales de " + (c.title || "") + " — " + TITULO_SITIO;
    pintarTexto(document.getElementById("cat-intro"), c.intro || "", enlacesPerfil);
    const aviso = document.getElementById("cat-aviso");
    aviso.hidden = !c.aviso;
    aviso.textContent = c.aviso || "";

    // traigo los tutoriales y los capítulos de una vez (son pocos) y los reparto por tutorial
    capitulosPorTutorial = {};
    arbol.caps.forEach((d) => {
      const t = d.data().tutorialId;
      (capitulosPorTutorial[t] = capitulosPorTutorial[t] || []).push(d);
    });

    selTutorial.replaceChildren(...tutoriales.map((d) => {
      const o = document.createElement("option");
      o.value = d.id;
      o.textContent = (d.data().title || "") + marcaOculto(d);
      return o;
    }));
    descripcionesTutorial = {};
    tutoriales.forEach((d) => { descripcionesTutorial[d.id] = d.data().description || ""; });
    mostrarDescripcionTutorial(selTutorial.value);
    llenarCapitulos(selTutorial.value);
    tutEstado.textContent = tutoriales.length ? "" : "Esta página todavía no tiene tutoriales.";
  } catch (err) {
    console.error("Error cargando tutoriales:", err);
    if (err && err.code === "permission-denied") { tutEstado.textContent = "No se encontró esta página de tutoriales."; return; }
    tutEstado.textContent = "No se pudieron cargar los tutoriales. Inténtalo de nuevo en un rato.";
  }
}

selTutorial.addEventListener("change", () => {
  mostrarDescripcionTutorial(selTutorial.value);
  llenarCapitulos(selTutorial.value);
});

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
  prepararOpinion(cap);
  player.focus();
});

// ================== OPINIÓN: ESTRELLAS Y COMENTARIO ==================
// Se guarda en la colección tut_feedback (solo se puede escribir; la lee únicamente el panel de Leslie).
// Freno de spam: casilla trampa, 30 s entre envíos desde este navegador y tope de 500 caracteres.
const fbForm = document.getElementById("fb-form");
const fbTitulo = document.getElementById("fb-titulo");
const fbEstado = document.getElementById("fb-estado");
const fbEnviar = document.getElementById("fb-enviar");
const fbComentario = document.getElementById("fb-comentario");
const FB_ESPERA_MS = 30000;
let fbCapitulo = null; // { id, tutorialId, titulo } del capítulo cargado en el reproductor

function prepararOpinion(cap) {
  const d = cap.data();
  // en la vista previa un borrador no se puede valorar: la regla solo admite capítulos visibles
  if (d.oculto) { fbForm.hidden = true; fbCapitulo = null; return; }
  fbCapitulo = { id: cap.id, tutorialId: d.tutorialId || "", titulo: d.title || "" };
  fbForm.reset();
  fbEstado.textContent = "";
  fbTitulo.textContent = "Tu opinión sobre: " + fbCapitulo.titulo;
  fbForm.hidden = false;
}

function ocultarOpinion() {
  fbCapitulo = null;
  fbForm.hidden = true;
  fbEstado.textContent = "";
}

fbForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!fbCapitulo) return;
  const marcada = fbForm.querySelector('input[name="fb-estrellas"]:checked');
  if (!marcada) {
    fbEstado.textContent = "Elige de 1 a 5 estrellas antes de enviar.";
    fbForm.querySelector('input[name="fb-estrellas"]').focus();
    return;
  }
  // casilla trampa: un bot la rellena; se responde como si fuera bien y no se guarda nada
  if (document.getElementById("fb-web").value) {
    fbEstado.textContent = "Gracias, tu opinión se ha enviado.";
    fbForm.reset();
    return;
  }
  let ultimo = 0;
  try { ultimo = Number(localStorage.getItem("fb_ultimo")) || 0; } catch (_) { /* sin almacenamiento: no hay límite local */ }
  const faltan = Math.ceil((ultimo + FB_ESPERA_MS - Date.now()) / 1000);
  if (faltan > 0) {
    fbEstado.textContent = "Espera " + faltan + " segundos antes de enviar otra opinión.";
    return;
  }
  fbEnviar.disabled = true;
  fbEstado.textContent = "Enviando…";
  try {
    await addDoc(collection(db, "tut_feedback"), {
      chapterId: fbCapitulo.id,
      tutorialId: fbCapitulo.tutorialId,
      stars: Number(marcada.value),
      comment: fbComentario.value.trim().slice(0, 500),
      createdAt: serverTimestamp()
    });
    try { localStorage.setItem("fb_ultimo", String(Date.now())); } catch (_) { /* nada */ }
    fbForm.reset();
    fbEstado.textContent = "Gracias, tu opinión se ha enviado.";
  } catch (err) {
    console.error("Error enviando la opinión:", err);
    fbEstado.textContent = "No se pudo enviar ahora. Inténtalo de nuevo en un rato.";
  } finally {
    fbEnviar.disabled = false;
  }
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

// ================== CONTADOR DE VISITAS ==================
// Suma 1 por sección y por día en la colección page_views. Una vez por sesión de pestaña y sección.
// No cuenta si hay sesión del panel abierta ni en vista previa. Solo Leslie puede leerlo (en admin.html).
async function contarVisita(clave, nombre) {
  try {
    if (VISTA_PREVIA) return;
    await auth.authStateReady();
    if (auth.currentUser) return;
    const marca = "visita:" + clave;
    if (sessionStorage.getItem(marca)) return;
    sessionStorage.setItem(marca, "1");
    const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
    await setDoc(doc(db, "page_views", clave), {
      nombre: String(nombre).slice(0, 80),
      total: increment(1),
      dias: { [dia]: increment(1) },
      ultima: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn("No se pudo contar la visita:", err);
  }
}

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
  if (vista.id === "tutorial") contarVisita("tut-" + param.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60), "Categoría " + param);
  else contarVisita(vista.id, titulo.textContent);
  // al cambiar de sección, el lector empieza a leer desde su título
  if (moverFoco) titulo.focus();
}

window.addEventListener("hashchange", () => mostrarVista(true));
mostrarVista(false);
