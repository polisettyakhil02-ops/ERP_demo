import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import AdmissionForm from "../components/admissions/AdmissionForm";

function OpenAdmissionForm() {
  const location = useLocation();
  const navigate = useNavigate();
  const admissionData = location?.state?.admissionData;
  const fromApplication = Boolean(location?.state?.fromApplication);

  const handleSaved = () => {
    if (fromApplication) {
      navigate("/admissions");
    } else {
      toast.success("Admission saved successfully.");
    }
  };

  return (
    <div>
      <AdmissionForm
        admission={admissionData}
        isModelView={false}
        onSaved={handleSaved}
      />
    </div>
  );
}

export default OpenAdmissionForm;
