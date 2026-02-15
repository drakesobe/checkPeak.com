// /hooks/org/prescriptions/useTemplateActions.js
import { useCallback, useMemo, useState } from "react";

export function useTemplateActions({
  templates,
  fetchTemplates,
  orgAuthHeaders,
  user,
  structured,
  title,
  setTitle,
  setStructured,
  setView,
  setError,
  setTemplatesError,
}) {
  const [templateId, setTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateNotes, setTemplateNotes] = useState("");

  // delete modal state
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const templateById = useMemo(() => {
    const id = String(templateId || "").trim();
    if (!id) return null;
    return (templates || []).find((t) => String(t?.id) === id) || null;
  }, [templates, templateId]);

  const applyTemplateToBuilder = useCallback(
    (tplId) => {
      const id = String(tplId || "").trim();
      if (!id) return;

      const tpl = (templates || []).find((t) => String(t?.id) === id);
      if (!tpl) return setTemplatesError("Template not found.");

      if (!tpl.structured || typeof tpl.structured !== "object") {
        return setTemplatesError(
          "This template is missing structured JSON. Open Airtable and confirm the “Structured” field is valid JSON."
        );
      }

      setStructured((prev) => ({ ...prev, ...tpl.structured }));
      if (!title || title === "Nutrition + Supplements Plan") setTitle(tpl.name || "Nutrition + Supplements Plan");
      setView("builder");
    },
    [templates, title, setTemplatesError, setStructured, setTitle, setView]
  );

  const saveAsTemplate = useCallback(async () => {
    setError("");
    setTemplatesError("");

    const name = String(templateName || "").trim();
    if (!name) return setTemplatesError("Enter a template name first.");

    try {
      const res = await fetch("/api/org/createPlanTemplate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...orgAuthHeaders },
        body: JSON.stringify({
          templateName: name,
          createdBy: user?.Email || user?.email || "",
          structured,
          notes: templateNotes || "",
          status: "Active",
          tags: "",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.airtable?.message || "Failed to save template.");

      await fetchTemplates();
      if (data?.template?.id) setTemplateId(String(data.template.id));

      setTemplateName("");
      setTemplateNotes("");
    } catch (err) {
      console.error("[org/prescriptions] saveAsTemplate error:", err);
      setTemplatesError(err?.message || "Failed to save template.");
    }
  }, [orgAuthHeaders, user, structured, templateName, templateNotes, fetchTemplates, setError, setTemplatesError]);

  const openDeleteTemplateConfirm = useCallback(() => {
    setDeleteError("");
    if (!templateId) return;
    setConfirmDeleteOpen(true);
  }, [templateId]);

  const deleteTemplate = useCallback(async () => {
    setDeleteError("");
    const id = String(templateId || "").trim();
    if (!id) return;

    setDeleteBusy(true);
    try {
      const res = await fetch("/api/org/deletePlanTemplate", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...orgAuthHeaders },
        body: JSON.stringify({ templateId: id }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.airtable?.message || "Failed to delete template.");

      setTemplateId("");
      await fetchTemplates();
      setConfirmDeleteOpen(false);
    } catch (err) {
      console.error("[org/prescriptions] deleteTemplate error:", err);
      setDeleteError(err?.message || "Failed to delete template.");
    } finally {
      setDeleteBusy(false);
    }
  }, [templateId, orgAuthHeaders, fetchTemplates]);

  return {
    templateId,
    setTemplateId,
    templateName,
    setTemplateName,
    templateNotes,
    setTemplateNotes,

    templateById,

    confirmDeleteOpen,
    setConfirmDeleteOpen,
    deleteBusy,
    deleteError,
    setDeleteError,

    applyTemplateToBuilder,
    saveAsTemplate,
    openDeleteTemplateConfirm,
    deleteTemplate,
  };
}
