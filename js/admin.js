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
  document.getElementById("project-oculto").checked = !!project.oculto;
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
    imageUrl: document.getElementById("project-image").value,
    oculto: document.getElementById("project-oculto").checked
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
    title.textContent = (project.title || "") + (project.oculto ? " (Oculto)" : "");
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

// ================== TUTORIALES (categorías > tutoriales > capítulos) ==================
// El mismo patrón que los proyectos: un formulario para agregar o editar, lista con Editar y Eliminar.

function hacerCrud({ prefijo, coleccion, leerFormulario, rellenarFormulario, textoFila, trasGuardar }) {
  const form = document.getElementById(prefijo + "-form") || document.getElementById(prefijo + "-admin-form");
  const titulo = document.getElementById(prefijo + "-form-title");
  const submit = document.getElementById(prefijo + "-submit");
  const cancel = document.getElementById(prefijo + "-cancel");
  const status = document.getElementById(prefijo + "-status");
  const lista = document.getElementById("admin-" + prefijo + "-list");
  let editandoId = null;

  function terminarEdicion() {
    editandoId = null;
    form.reset();
    titulo.textContent = titulo.textContent.replace(/^Editar.*$/, "Agregar " + titulo.dataset.base);
    submit.textContent = "Agregar";
    cancel.hidden = true;
  }
  titulo.dataset.base = titulo.textContent.replace(/^Agregar /, "");

  cancel.addEventListener("click", () => {
    terminarEdicion();
    status.textContent = "Edición cancelada.";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "Guardando…";
    const datos = leerFormulario();
    try {
      if (editandoId) {
        await updateDoc(doc(db, coleccion, editandoId), datos);
        status.textContent = "Cambios guardados ✓";
      } else {
        await addDoc(collection(db, coleccion), { ...datos, createdAt: Date.now() });
        status.textContent = "Agregado ✓";
      }
      terminarEdicion();
      cargarLista();
      if (trasGuardar) trasGuardar();
    } catch (err) {
      status.textContent = "Error: " + err.message;
    }
  });

  async function cargarLista() {
    lista.innerHTML = "";
    const snap = await getDocs(query(collection(db, coleccion), orderBy("order", "asc")));
    snap.forEach((docSnap) => {
      const dato = docSnap.data();
      const row = document.createElement("div");
      row.className = "admin-project-row";
      const info = document.createElement("div");
      info.className = "info";
      const h = document.createElement("h3");
      h.textContent = textoFila(dato).titulo;
      info.appendChild(h);
      const detalle = textoFila(dato).detalle;
      if (detalle) {
        const p = document.createElement("p");
        p.textContent = detalle;
        info.appendChild(p);
      }
      row.appendChild(info);

      const editBtn = document.createElement("button");
      editBtn.textContent = "Editar";
      editBtn.className = "btn-editar";
      editBtn.setAttribute("aria-label", "Editar " + textoFila(dato).titulo);
      editBtn.addEventListener("click", () => {
        editandoId = docSnap.id;
        rellenarFormulario(dato);
        titulo.textContent = "Editar: " + textoFila(dato).titulo;
        submit.textContent = "Guardar cambios";
        cancel.hidden = false;
        status.textContent = "";
        form.scrollIntoView({ block: "center" });
        form.querySelector("input, textarea, select").focus();
      });
      row.appendChild(editBtn);

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Eliminar";
      deleteBtn.className = "btn-eliminar";
      deleteBtn.setAttribute("aria-label", "Eliminar " + textoFila(dato).titulo);
      deleteBtn.addEventListener("click", async () => {
        if (!confirm(`¿Eliminar "${textoFila(dato).titulo}"?`)) return;
        await deleteDoc(doc(db, coleccion, docSnap.id));
        if (editandoId === docSnap.id) terminarEdicion();
        cargarLista();
        if (trasGuardar) trasGuardar();
      });
      row.appendChild(deleteBtn);

      lista.appendChild(row);
    });
  }

  return cargarLista;
}

// --- categorías de tutoriales ---
let cacheCategorias = [];
let cacheTutoriales = [];

const cargarCategorias = hacerCrud({
  prefijo: "cat",
  coleccion: "tut_categories",
  leerFormulario: () => ({
    title: document.getElementById("cat-title").value,
    intro: document.getElementById("cat-intro").value,
    aviso: document.getElementById("cat-aviso").value,
    order: Number(document.getElementById("cat-order").value) || 0,
    oculto: document.getElementById("cat-oculto").checked
  }),
  rellenarFormulario: (c) => {
    document.getElementById("cat-title").value = c.title || "";
    document.getElementById("cat-intro").value = c.intro || "";
    document.getElementById("cat-aviso").value = c.aviso || "";
    document.getElementById("cat-order").value = c.order ?? 0;
    document.getElementById("cat-oculto").checked = !!c.oculto;
  },
  textoFila: (c) => ({ titulo: (c.title || "") + (c.oculto ? " (Oculto)" : ""), detalle: c.aviso ? "Con aviso: " + c.aviso : "" }),
  trasGuardar: () => refrescarSelectsTutoriales()
});

// --- tutoriales ---
const cargarTutoriales = hacerCrud({
  prefijo: "tut",
  coleccion: "tut_tutorials",
  leerFormulario: () => ({
    categoryId: document.getElementById("tut-cat").value,
    title: document.getElementById("tut-title").value,
    description: document.getElementById("tut-desc").value,
    order: Number(document.getElementById("tut-order").value) || 0,
    oculto: document.getElementById("tut-oculto").checked
  }),
  rellenarFormulario: (t) => {
    document.getElementById("tut-cat").value = t.categoryId || "";
    document.getElementById("tut-title").value = t.title || "";
    document.getElementById("tut-desc").value = t.description || "";
    document.getElementById("tut-order").value = t.order ?? 0;
    document.getElementById("tut-oculto").checked = !!t.oculto;
  },
  textoFila: (t) => ({
    titulo: (t.title || "") + (t.oculto ? " (Oculto)" : ""),
    detalle: "Categoría: " + ((cacheCategorias.find((c) => c.id === t.categoryId) || {}).title || "?")
  }),
  trasGuardar: () => refrescarSelectsTutoriales()
});

// --- capítulos ---
const cargarCapitulos = hacerCrud({
  prefijo: "cap",
  coleccion: "tut_chapters",
  leerFormulario: () => ({
    tutorialId: document.getElementById("cap-tut").value,
    title: document.getElementById("cap-title").value,
    audioUrl: document.getElementById("cap-audio").value,
    order: Number(document.getElementById("cap-order").value) || 0,
    oculto: document.getElementById("cap-oculto").checked
  }),
  rellenarFormulario: (c) => {
    document.getElementById("cap-tut").value = c.tutorialId || "";
    document.getElementById("cap-title").value = c.title || "";
    document.getElementById("cap-audio").value = c.audioUrl || "";
    document.getElementById("cap-order").value = c.order ?? 0;
    document.getElementById("cap-oculto").checked = !!c.oculto;
  },
  textoFila: (c) => ({
    titulo: (c.title || "") + (c.oculto ? " (Oculto)" : ""),
    detalle: "Tutorial: " + ((cacheTutoriales.find((t) => t.id === c.tutorialId) || {}).title || "?")
  })
});

// rellena los dos cuadros del panel (categoría de un tutorial, tutorial de un capítulo)
async function refrescarSelectsTutoriales() {
  const [snapCat, snapTut] = await Promise.all([
    getDocs(query(collection(db, "tut_categories"), orderBy("order", "asc"))),
    getDocs(query(collection(db, "tut_tutorials"), orderBy("order", "asc")))
  ]);
  cacheCategorias = snapCat.docs.map((d) => ({ id: d.id, ...d.data() }));
  cacheTutoriales = snapTut.docs.map((d) => ({ id: d.id, ...d.data() }));

  const selCat = document.getElementById("tut-cat");
  const valorCat = selCat.value;
  selCat.replaceChildren(...cacheCategorias.map((c) => {
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = c.title || "";
    return o;
  }));
  selCat.value = valorCat;

  const selTut = document.getElementById("cap-tut");
  const valorTut = selTut.value;
  selTut.replaceChildren(...cacheTutoriales.map((t) => {
    const o = document.createElement("option");
    o.value = t.id;
    const cat = cacheCategorias.find((c) => c.id === t.categoryId);
    o.textContent = (cat ? cat.title + " — " : "") + (t.title || "");
    return o;
  }));
  selTut.value = valorTut;
}

async function cargarSeccionTutoriales() {
  await refrescarSelectsTutoriales();
  await cargarCategorias();
  await cargarTutoriales();
  await cargarCapitulos();
}

// se cargan al entrar, junto con el perfil y los proyectos
const _onAuthTutoriales = onAuthStateChanged(auth, (user) => {
  if (user) cargarSeccionTutoriales().catch((err) => console.error("Error cargando tutoriales:", err));
});
