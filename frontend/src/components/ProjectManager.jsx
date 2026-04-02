/**
 * @module ProjectManager
 * @purpose Manage internal projects for synergy matching
 *
 * @reads    projectStore.js → getProjects()
 * @writes   projectStore.js → saveProject(), deleteProject()
 * @calledBy App.jsx → projects view
 * @calls    projectStore.js → initDefaultProjects()
 *
 * @dataflow Project form → validation → save to store → refresh list
 *
 * @props
 *   onClose: () => void - Close handler
 *
 * @errors Validates required fields, shows confirmation on delete
 */

import { useState, useEffect } from "react";
import {
  getProjects,
  saveProject,
  deleteProject,
  initDefaultProjects,
} from "../stores/projectStore.js";

function ProjectManager({ onClose }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    description: "",
    technologies: "",
    status: "aktiv",
    challenges: "",
  });

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      await initDefaultProjects();
      const data = await getProjects();
      setProjects(data);
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setLoading(false);
    }
  };

  // Start editing a project
  const handleEdit = (project) => {
    setEditing(project.id);
    setFormData({
      id: project.id,
      name: project.name,
      description: project.description,
      technologies: project.technologies.join(", "),
      status: project.status,
      challenges: project.challenges.join(", "),
    });
    setShowForm(true);
  };

  // Start creating new project
  const handleNew = () => {
    setEditing(null);
    setFormData({
      id: "",
      name: "",
      description: "",
      technologies: "",
      status: "aktiv",
      challenges: "",
    });
    setShowForm(true);
  };

  // Save project
  const handleSave = async (e) => {
    e.preventDefault();

    const project = {
      id: editing || `proj-${Date.now()}`,
      name: formData.name,
      description: formData.description,
      technologies: formData.technologies
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t),
      status: formData.status,
      challenges: formData.challenges
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c),
    };

    try {
      await saveProject(project);
      await loadProjects();
      setShowForm(false);
      setEditing(null);
    } catch (error) {
      console.error("Failed to save project:", error);
      alert("Fehler beim Speichern des Projekts");
    }
  };

  // Delete project
  const handleDelete = async (id) => {
    if (confirm("Möchten Sie dieses Projekt wirklich löschen?")) {
      try {
        await deleteProject(id);
        await loadProjects();
      } catch (error) {
        console.error("Failed to delete project:", error);
        alert("Fehler beim Löschen des Projekts");
      }
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      aktiv: "bg-green-100 text-green-800",
      geplant: "bg-yellow-100 text-yellow-800",
      abgeschlossen: "bg-gray-100 text-gray-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  // Get status label
  const getStatusLabel = (status) => {
    const labels = {
      aktiv: "Aktiv",
      geplant: "Geplant",
      abgeschlossen: "Abgeschlossen",
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Lade Projekte...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Projekte</h2>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
        >
          ✕
        </button>
      </div>

      {!showForm ? (
        <>
          {/* Project list */}
          <div className="mb-4">
            <button
              onClick={handleNew}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              + Neues Projekt
            </button>
          </div>

          <div className="space-y-4">
            {projects.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                Noch keine Projekte vorhanden
              </div>
            ) : (
              projects.map((project) => (
                <div
                  key={project.id}
                  className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900">
                          {project.name}
                        </h3>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(
                            project.status
                          )}`}
                        >
                          {getStatusLabel(project.status)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        {project.description}
                      </p>

                      {project.technologies.length > 0 && (
                        <div className="mb-2">
                          <span className="text-xs text-gray-500">
                            Technologien:{" "}
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {project.technologies.map((tech, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full"
                              >
                                {tech}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {project.challenges.length > 0 && (
                        <div>
                          <span className="text-xs text-gray-500">
                            Herausforderungen:{" "}
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {project.challenges.map((challenge, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 text-xs bg-orange-100 text-orange-800 rounded-full"
                              >
                                {challenge}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(project)}
                        className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                      >
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200"
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        /* Project form */
        <form onSubmit={handleSave} className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">
            {editing ? "Projekt bearbeiten" : "Neues Projekt"}
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Beschreibung *
            </label>
            <textarea
              required
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Technologien (kommagetrennt)
            </label>
            <input
              type="text"
              value={formData.technologies}
              onChange={(e) =>
                setFormData({ ...formData, technologies: e.target.value })
              }
              placeholder="z.B. React, Node.js, PostgreSQL"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="aktiv">Aktiv</option>
              <option value="geplant">Geplant</option>
              <option value="abgeschlossen">Abgeschlossen</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Herausforderungen (kommagetrennt)
            </label>
            <input
              type="text"
              value={formData.challenges}
              onChange={(e) =>
                setFormData({ ...formData, challenges: e.target.value })
              }
              placeholder="z.B. Budget, Zeit, Ressourcen"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Speichern
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default ProjectManager;
