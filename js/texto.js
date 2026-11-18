// Convierte el texto escrito en el panel en texto con enlaces.
// Formato: [palabras que se ven](a dónde lleva)
//   a dónde lleva puede ser una dirección (https://...), un correo (alguien@correo.com)
//   o una de estas palabras, que usan los enlaces guardados en el perfil:
//   github, linkedin, correo (o email).
// Una línea en blanco separa párrafos.

const ATAJOS = {
  github: "GitHub",
  linkedin: "LinkedIn",
  correo: "Correo",
  email: "Correo",
  mail: "Correo"
};

const PATRON = /\[([^\]]+)\]\(([^)]+)\)/g;

function aMailto(correo) {
  correo = correo.trim();
  if (!correo) return null;
  return correo.toLowerCase().startsWith("mailto:") ? correo : "mailto:" + correo;
}

// Devuelve { url, clave } o null si no se entiende a dónde lleva
export function resolverDestino(destino, enlaces = {}) {
  const d = destino.trim();
  const clave = ATAJOS[d.toLowerCase()];
  if (clave) {
    const valor = (enlaces[clave] || "").trim();
    if (!valor) return null;
    return { url: clave === "Correo" ? aMailto(valor) : valor, clave };
  }
  if (/^https?:\/\//i.test(d)) return { url: d, clave: null };
  if (/^mailto:/i.test(d)) return { url: d, clave: null };
  if (/^www\./i.test(d)) return { url: "https://" + d, clave: null };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d)) return { url: "mailto:" + d, clave: null };
  return null;
}

function crearEnlace(texto, url) {
  const a = document.createElement("a");
  a.href = url;
  a.textContent = texto;
  if (!url.toLowerCase().startsWith("mailto:")) {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  }
  return a;
}

// Añade a "destino" el texto de una línea, con sus enlaces
function pintarLinea(destino, linea, enlaces, usados, problemas) {
  let ultimo = 0;
  for (const m of linea.matchAll(PATRON)) {
    if (m.index > ultimo) destino.append(linea.slice(ultimo, m.index));
    const r = resolverDestino(m[2], enlaces);
    if (r) {
      destino.appendChild(crearEnlace(m[1], r.url));
      if (r.clave) usados.add(r.clave);
    } else {
      destino.append(m[1]);
      problemas.push(m[0]);
    }
    ultimo = m.index + m[0].length;
  }
  if (ultimo < linea.length) destino.append(linea.slice(ultimo));
}

// Rellena "contenedor" con el texto.
// parrafos: true crea un <p> por párrafo (para un <div>); false lo pone todo dentro del propio contenedor.
// Devuelve { usados: claves de enlaces del perfil que aparecen en el texto, problemas: enlaces que no se entendieron }
export function pintarTexto(contenedor, texto, enlaces = {}, { parrafos = true } = {}) {
  contenedor.replaceChildren();
  const usados = new Set(), problemas = [];
  const bloques = (texto || "").split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  for (const bloque of bloques) {
    let destino = contenedor;
    if (parrafos) {
      destino = document.createElement("p");
      contenedor.appendChild(destino);
    } else if (contenedor.childNodes.length) {
      contenedor.appendChild(document.createElement("br"));
    }
    bloque.split("\n").forEach((linea, i) => {
      if (i) destino.appendChild(document.createElement("br"));
      pintarLinea(destino, linea, enlaces, usados, problemas);
    });
  }
  return { usados, problemas };
}
