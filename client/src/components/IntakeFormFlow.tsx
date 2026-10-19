import { useState } from "react";

interface IntakeFormProps {
  onBack: () => void;
  onSubmit: (data: IntakeData) => void;
}

interface IntakeData {
  // Personal Info
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  
  // Situation
  housingStatus: string;
  monthlyIncome: string;
  familySize: number;
  servicesNeeded: string[];
  
  // Documents
  hasID: boolean;
  hasProofOfIncome: boolean;
  hasMedicalRecords: boolean;
  
  // Privacy & Consent
  ageVerified: boolean;
  locationPrivacy: boolean;
  dataSharing: boolean;
  contactPreference: string;
  accessibilityNeeds: string[];
}

export default function IntakeFormFlow({ onBack, onSubmit }: IntakeFormProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<IntakeData>({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    phone: "",
    email: "",
    housingStatus: "",
    monthlyIncome: "",
    familySize: 1,
    servicesNeeded: [],
    hasID: false,
    hasProofOfIncome: false,
    hasMedicalRecords: false,
    ageVerified: false,
    locationPrivacy: true,
    dataSharing: false,
    contactPreference: "phone",
    accessibilityNeeds: [],
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleServiceToggle = (service: string) => {
    setFormData((prev) => ({
      ...prev,
      servicesNeeded: prev.servicesNeeded.includes(service)
        ? prev.servicesNeeded.filter((s) => s !== service)
        : [...prev.servicesNeeded, service],
    }));
  };

  const handleAccessibilityToggle = (need: string) => {
    setFormData((prev) => ({
      ...prev,
      accessibilityNeeds: prev.accessibilityNeeds.includes(need)
        ? prev.accessibilityNeeds.filter((n) => n !== need)
        : [...prev.accessibilityNeeds, need],
    }));
  };

  const canProceed = () => {
    if (step === 1) return formData.firstName && formData.lastName && formData.dateOfBirth;
    if (step === 2) return formData.housingStatus && formData.servicesNeeded.length > 0;
    if (step === 3) return true;
    if (step === 4) return formData.ageVerified && formData.dataSharing;
    return false;
  };

  const handleSubmit = async () => {
    if (!canProceed()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${formData.firstName} ${formData.lastName}`,
          dob: formData.dateOfBirth,
          phone: formData.phone,
          situation: formData.housingStatus,
          needs: formData.servicesNeeded,
          consent: formData.dataSharing,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit intake form");
      }

      const data = await response.json();
      onSubmit(formData);
      // Referral ID: data.referralId is available for confirmation screen
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit form");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 flex items-center gap-3">
        <button onClick={onBack} className="text-2xl">‹</button>
        <h1 className="text-xl font-bold">Intake Form</h1>
      </div>

      {/* Progress Indicator */}
      <div className="flex gap-2 p-4 bg-gray-100">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`flex-1 h-2 rounded ${
              s <= step ? "bg-blue-600" : "bg-gray-300"
            }`}
          />
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {/* Step 1: Personal Information */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Personal Information</h2>
            <div>
              <label className="block text-sm font-medium mb-1">First Name *</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => handleInputChange("firstName", e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="First name"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Last Name *</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => handleInputChange("lastName", e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="Last name"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date of Birth *</label>
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleInputChange("dateOfBirth", e.target.value)}
                className="w-full border rounded px-3 py-2"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone Number</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="(555) 123-4567"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="email@example.com"
                disabled={loading}
              />
            </div>
          </div>
        )}

        {/* Step 2: Situation Assessment */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Your Situation</h2>
            <div>
              <label className="block text-sm font-medium mb-2">Housing Status *</label>
              <select
                value={formData.housingStatus}
                onChange={(e) => handleInputChange("housingStatus", e.target.value)}
                className="w-full border rounded px-3 py-2"
                disabled={loading}
              >
                <option value="">Select...</option>
                <option value="homeless">Currently Homeless</option>
                <option value="at-risk">At Risk of Homelessness</option>
                <option value="unstable">Unstable Housing</option>
                <option value="housed">Housed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Monthly Income</label>
              <input
                type="text"
                value={formData.monthlyIncome}
                onChange={(e) => handleInputChange("monthlyIncome", e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="$0"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Family Size</label>
              <input
                type="number"
                min="1"
                value={formData.familySize}
                onChange={(e) => handleInputChange("familySize", parseInt(e.target.value))}
                className="w-full border rounded px-3 py-2"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">What services do you need? *</label>
              <div className="space-y-2">
                {["Emergency Shelter", "Food Assistance", "Medical Care", "Mental Health", "Housing", "Transportation", "Legal Help", "Employment", "Documents/ID"].map((service) => (
                  <label key={service} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.servicesNeeded.includes(service)}
                      onChange={() => handleServiceToggle(service)}
                      className="w-4 h-4"
                      disabled={loading}
                    />
                    <span className="text-sm">{service}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Documents */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Documents</h2>
            <p className="text-sm text-gray-600 mb-4">Upload any documents that might help us serve you better.</p>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.hasID}
                onChange={(e) => handleInputChange("hasID", e.target.checked)}
                className="w-4 h-4"
                disabled={loading}
              />
              <span className="text-sm">Photo ID</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.hasProofOfIncome}
                onChange={(e) => handleInputChange("hasProofOfIncome", e.target.checked)}
                className="w-4 h-4"
                disabled={loading}
              />
              <span className="text-sm">Proof of Income</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.hasMedicalRecords}
                onChange={(e) => handleInputChange("hasMedicalRecords", e.target.checked)}
                className="w-4 h-4"
                disabled={loading}
              />
              <span className="text-sm">Medical Records</span>
            </label>
          </div>
        )}

        {/* Step 4: Privacy & Consent */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Privacy & Consent</h2>
            
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={formData.ageVerified}
                  onChange={(e) => handleInputChange("ageVerified", e.target.checked)}
                  className="w-4 h-4 mt-1"
                  disabled={loading}
                />
                <span className="text-sm">
                  I confirm I am 18 years or older (or have guardian consent) *
                </span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Location Privacy</label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.locationPrivacy}
                  onChange={(e) => handleInputChange("locationPrivacy", e.target.checked)}
                  className="w-4 h-4"
                  disabled={loading}
                />
                <span className="text-sm">Hide my location from other users</span>
              </label>
            </div>

            <div className="bg-green-50 border border-green-200 rounded p-3">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={formData.dataSharing}
                  onChange={(e) => handleInputChange("dataSharing", e.target.checked)}
                  className="w-4 h-4 mt-1"
                  disabled={loading}
                />
                <span className="text-sm">
                  I consent to sharing my information with service providers to help connect me with resources *
                </span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Preferred Contact Method</label>
              <select
                value={formData.contactPreference}
                onChange={(e) => handleInputChange("contactPreference", e.target.value)}
                className="w-full border rounded px-3 py-2"
                disabled={loading}
              >
                <option value="phone">Phone</option>
                <option value="email">Email</option>
                <option value="text">Text Message</option>
                <option value="in-person">In Person Only</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Accessibility Needs</label>
              <div className="space-y-2">
                {["Large Print", "Audio Format", "Sign Language Interpreter", "Service Animal Accommodation"].map((need) => (
                  <label key={need} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.accessibilityNeeds.includes(need)}
                      onChange={() => handleAccessibilityToggle(need)}
                      className="w-4 h-4"
                      disabled={loading}
                    />
                    <span className="text-sm">{need}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex gap-3">
        <button
          onClick={() => setStep(Math.max(1, step - 1))}
          disabled={step === 1 || loading}
          className="flex-1 px-4 py-3 border rounded font-medium disabled:opacity-50"
        >
          Back
        </button>
        {step < 4 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed() || loading}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded font-medium disabled:opacity-50"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canProceed() || loading}
            className="flex-1 px-4 py-3 bg-green-600 text-white rounded font-medium disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit"}
          </button>
        )}
      </div>
    </div>
  );
}
