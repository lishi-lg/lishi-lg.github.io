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
    img.alt = project.title || "";
    card.appendChild(img);
  }

  const body = document.createElement("div");
  body.className = "project-card-body";

  const title = document.createElement("h3");
  title.textContent = project.title || "";
  body.appendChild(title);

  const desc = document.createElement("p");
  pintarTexto(desc, project.description || "", links, { parrafos: false });
  body.appendChild(desc);

  if (project.link) {
    const link = document.createElement("a");
    link.href = project.link;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Ver proyecto →";
    link.setAttribute("aria-label", "Ver proyecto " + (project.title || ""));
    body.appendChild(link);
  }

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
