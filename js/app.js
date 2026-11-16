import { db } from "./firebase-config.js";
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
  if (!snap.exists()) return;

  const data = snap.data();
  if (data.name) document.getElementById("profile-name").textContent = data.name;
  document.getElementById("profile-tagline").textContent = data.tagline || "";
  document.getElementById("profile-bio").textContent = data.bio || "";

  if (data.photoUrl) {
    const img = document.getElementById("profile-photo");
    img.src = data.photoUrl;
    img.hidden = false;
  }

  const linksEl = document.getElementById("profile-links");
  const links = data.links || {};
  Object.entries(links).forEach(([label, url]) => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = label === "Correo" && !url.startsWith("mailto:") ? "mailto:" + url : url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = label;
    linksEl.appendChild(a);
  });
}

function createProjectCard(project) {
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
  desc.textContent = project.description || "";
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

async function loadProjects() {
  const grid = document.getElementById("projects-grid");
  const q = query(collection(db, "projects"), orderBy("order", "asc"));
  const snap = await getDocs(q);

  if (snap.empty) {
    document.getElementById("projects-empty").hidden = false;
    return;
  }

  snap.forEach((docSnap) => {
    grid.appendChild(createProjectCard(docSnap.data()));
  });
}

loadProfile().catch((err) => console.error("Error cargando perfil:", err));
loadProjects().catch((err) => console.error("Error cargando proyectos:", err));
