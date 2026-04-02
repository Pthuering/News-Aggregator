/**
 * @module projectStore
 * @purpose IndexedDB storage for internal projects
 *
 * @reads    settings.js → database config
 * @writes   IndexedDB → projects store
 * @calledBy ProjectManager.jsx → CRUD operations
 * @calledBy matchService.js → read projects for synergy matching
 *
 * @dataflow ProjectConfig → IndexedDB → CRUD operations
 *
 * @exports
 *   initProjectStore(): Promise<void> – Initialize the database
 *   saveProject(project: ProjectConfig): Promise<void> – Save a project
 *   getProjects(): Promise<ProjectConfig[]> – Get all projects
 *   getProjectById(id: string): Promise<ProjectConfig|null> – Get single project
 *   updateProject(id: string, updates: Partial<ProjectConfig>): Promise<void> – Update project
 *   deleteProject(id: string): Promise<void> – Delete project
 *   getActiveProjects(): Promise<ProjectConfig[]> – Get only active projects
 *
 * @errors Logs errors to console, throws for critical failures
 */

import { openDB } from "idb";
import { settings } from "../config/settings.js";

const DB_NAME = settings.database.name;
const DB_VERSION = settings.database.version;
const STORE_NAME = settings.database.stores.projects;

let db = null;

/**
 * Initialize the project store database
 * @returns {Promise<void>}
 */
export async function initProjectStore() {
  if (db) return;

  try {
    db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("status", "status", { unique: false });
        }
      },
    });
  } catch (error) {
    console.error("Failed to initialize project store:", error);
    throw error;
  }
}

/**
 * Save a project to the database
 * @param {ProjectConfig} project - Project to save
 * @returns {Promise<void>}
 */
export async function saveProject(project) {
  if (!db) await initProjectStore();
  await db.put(STORE_NAME, project);
}

/**
 * Get all projects from the database
 * @returns {Promise<ProjectConfig[]>}
 */
export async function getProjects() {
  if (!db) await initProjectStore();
  return db.getAll(STORE_NAME);
}

/**
 * Get a single project by ID
 * @param {string} id - Project ID
 * @returns {Promise<ProjectConfig|null>}
 */
export async function getProjectById(id) {
  if (!db) await initProjectStore();
  return db.get(STORE_NAME, id);
}

/**
 * Update specific fields of a project
 * @param {string} id - Project ID
 * @param {Partial<ProjectConfig>} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateProject(id, updates) {
  if (!db) await initProjectStore();

  const existing = await db.get(STORE_NAME, id);
  if (!existing) {
    throw new Error(`Project with id ${id} not found`);
  }

  await db.put(STORE_NAME, { ...existing, ...updates });
}

/**
 * Delete a project from the database
 * @param {string} id - Project ID
 * @returns {Promise<void>}
 */
export async function deleteProject(id) {
  if (!db) await initProjectStore();
  await db.delete(STORE_NAME, id);
}

/**
 * Get projects with "aktiv" status
 * @returns {Promise<ProjectConfig[]>}
 */
export async function getActiveProjects() {
  if (!db) await initProjectStore();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const index = store.index("status");
  return index.getAll("aktiv");
}

// Default sample projects for initial setup
export const defaultProjects = [
  {
    id: "proj-1",
    name: "Fahrzeug-Tracking System",
    description: "Echtzeit-Tracking aller Busse und Bahnen mit GPS und IoT-Sensoren für präzise Ankunftszeiten.",
    technologies: ["GPS", "IoT", "LoRaWAN", "Cloud"],
    status: "aktiv",
    challenges: ["Abdeckung in Tunneln", "Batterielaufzeit", "Datenschutz"],
  },
  {
    id: "proj-2",
    name: "Mobilitäts-App 2.0",
    description: "Neue Kunden-App mit Ticketing, Echtzeitauskunft und Multimodal-Routing.",
    technologies: ["React Native", "Microservices", "Payment-APIs"],
    status: "geplant",
    challenges: ["UX-Design", "Payment-Integration", "Backend-Skalierung"],
  },
  {
    id: "proj-3",
    name: "KI-basierte Fahrplanoptimierung",
    description: "Machine Learning Modelle zur Vorhersage von Fahrgastaufkommen und dynamischen Fahrplananpassung.",
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
  if (!db) await initProjectStore();
  
  const existing = await getProjects();
  if (existing.length === 0) {
    for (const project of defaultProjects) {
      await saveProject(project);
    }
  }
}

export default {
  initProjectStore,
  saveProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  getActiveProjects,
  initDefaultProjects,
  defaultProjects,
};
