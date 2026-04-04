/**
 * @module projectStore
 * @purpose IndexedDB-Zugriff für interne Projekte
 *
 * @reads    nichts
 * @writes   nichts
 * @calledBy services/matchService.js → getProjects(), getProjectsAsContext()
 * @calledBy components/ProjectManager.jsx → CRUD-Operationen
 *
 * @exports
 *   getProjects(): Promise<ProjectConfig[]>
 *   saveProject(project: ProjectConfig): Promise<void>
 *   deleteProject(id: string): Promise<void>
 *   getProjectsAsContext(): Promise<string>
 *     → Formatiert alle aktiven Projekte als Text-Block für LLM-Prompt
 *       Format: "Projekt: {name}\nBeschreibung: {description}\n
 *                Technologien: {technologies}\nHerausforderungen: {challenges}\n---"
 *
 * @errors  Bei DB-Fehlern: Error werfen
 */

import { getDB } from "./db.js";

const STORE_NAME = "projects";

/**
 * Get all projects
 * @returns {Promise<ProjectConfig[]>}
 */
export async function getProjects() {
  const db = await getDB();
  return db.getAll(STORE_NAME);
}

/**
 * Save a project
 * @param {ProjectConfig} project - Project to save
 * @returns {Promise<void>}
 */
export async function saveProject(project) {
  const db = await getDB();
  await db.put(STORE_NAME, project);
}

/**
 * Delete a project
 * @param {string} id - Project ID
 * @returns {Promise<void>}
 */
export async function deleteProject(id) {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

/**
 * Format all active projects as context for LLM prompt
 * @returns {Promise<string>}
 */
export async function getProjectsAsContext() {
  const projects = await getProjects();
  const activeProjects = projects.filter((p) => p.status === "aktiv");

  if (activeProjects.length === 0) {
    return "Keine aktiven Projekte vorhanden.";
  }

  return activeProjects
    .map(
      (p) =>
        `Projekt: ${p.name}\nBeschreibung: ${p.description}\nTechnologien: ${
          p.technologies?.join(", ") || "keine"
        }\nHerausforderungen: ${p.challenges?.join(", ") || "keine"}\n---`
    )
    .join("\n");
}

// Default sample projects for initial setup
export const defaultProjects = [
  {
    id: "proj-1",
    name: "Fahrzeug-Tracking System",
    description:
      "Echtzeit-Tracking aller Busse und Bahnen mit GPS und IoT-Sensoren für präzise Ankunftszeiten.",
    technologies: ["GPS", "IoT", "LoRaWAN", "Cloud"],
    status: "aktiv",
    challenges: ["Abdeckung in Tunneln", "Batterielaufzeit", "Datenschutz"],
  },
  {
    id: "proj-2",
    name: "Mobilitäts-App 2.0",
    description:
      "Neue Kunden-App mit Ticketing, Echtzeitauskunft und Multimodal-Routing.",
    technologies: ["React Native", "Microservices", "Payment-APIs"],
    status: "geplant",
    challenges: ["UX-Design", "Payment-Integration", "Backend-Skalierung"],
  },
  {
    id: "proj-3",
    name: "KI-basierte Fahrplanoptimierung",
    description:
      "Machine Learning Modelle zur Vorhersage von Fahrgastaufkommen und dynamischen Fahrplananpassung.",
    technologies: ["Python", "TensorFlow", "Big Data"],
    status: "aktiv",
    challenges: ["Datenqualität", "Modell-Training", "Change Management"],
  },
];

/**
 * Initialize with default projects if empty
 * @returns {Promise<void>}
 */
export async function initDefaultProjects() {
  const existing = await getProjects();
  if (existing.length === 0) {
    for (const project of defaultProjects) {
      await saveProject(project);
    }
  }
}

export default {
  getProjects,
  saveProject,
  deleteProject,
  getProjectsAsContext,
  initDefaultProjects,
  defaultProjects,
};
