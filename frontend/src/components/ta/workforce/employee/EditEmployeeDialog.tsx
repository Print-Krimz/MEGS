import React, { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Dialog, Input, PhoneInput } from "../../../ui";
import { PhilippineAddressFields } from "../../../common/PhilippineAddressFields";
import { employeesApi } from "../../../../lib/api/employees.api";
import type { UpdateEmployeeDetailsDto } from "../../../../lib/types/employee.types";
import { notify } from "../../../../lib/feedback";
import {
  formatSSSNumber,
  formatPhilHealthNumber,
  formatPagIbigNumber,
  formatTINNumber,
  validateSSSNumber,
  validatePhilHealthNumber,
  validatePagIbigNumber,
  validateTINNumber,
  validatePhilippineContactPhone,
  validateEmergencyPhone,
  validatePersonName,
  validateStandardText,
  validateAddressText,
} from "../../../../lib/statutory-validation";

const EMPTY_FORM = {
  firstName: "",
  middleName: "",
  lastName: "",
  mobileNumber: "",
  address: "",
  city: "",
  province: "",
  barangay: "",
  postalCode: "",
  sss: "",
  philhealth: "",
  pagibig: "",
  tin: "",
  emergencyContactName: "",
  emergencyContactRelationship: "",
  emergencyContactPhone: "",
  emergencyContactAddress: "",
  position: "",
  department: "",
};

export interface EditEmployeeDialogProps {
  open: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  candidate: any;
  position?: string | null;
  department?: string | null;
}

/** Edit legal name, contact, statutory IDs, emergency contact and job details. */
export const EditEmployeeDialog: React.FC<EditEmployeeDialogProps> = ({
  open,
  onClose,
  employeeId,
  employeeName: empName,
  candidate: cand,
  position,
  department,
}) => {
  const queryClient = useQueryClient();
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  // Each time the dialog opens it starts from the saved record.
  useEffect(() => {
    if (!open) return;
    setEditFormErrors({});
    setEditForm({
      firstName: cand.firstName || "",
      middleName: cand.middleName || "",
      lastName: cand.lastName || "",
      mobileNumber: cand.mobileNumber || "",
      address: cand.address || "",
      city: cand.city || "",
      province: cand.province || "",
      barangay: cand.barangay || "",
      postalCode: cand.postalCode || "",
      sss: cand.sss ? formatSSSNumber(cand.sss) : "",
      philhealth: cand.philhealth ? formatPhilHealthNumber(cand.philhealth) : "",
      pagibig: cand.pagibig ? formatPagIbigNumber(cand.pagibig) : "",
      tin: cand.tin ? formatTINNumber(cand.tin) : "",
      emergencyContactName: cand.emergencyContactName || "",
      emergencyContactRelationship: cand.emergencyContactRelationship || "",
      emergencyContactPhone: cand.emergencyContactPhone || "",
      emergencyContactAddress: cand.emergencyContactAddress || "",
      position: position || "",
      department: department || "",
    });
    // Only reopening resets the form: a background refetch must not wipe what the user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const updateDetailsMutation = useMutation({
    mutationFn: (form: UpdateEmployeeDetailsDto) => employeesApi.updateEmployeeDetails(employeeId, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "employee", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "employees"] });
      onClose();
      notify.success("Employee updated", "Employee details were saved successfully.");
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      notify.error("Update failed", err?.message || "Unable to update employee details.");
    },
  });

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    const firstErr = validatePersonName(editForm.firstName, "First Name", { required: true });
    if (firstErr) errors.firstName = firstErr;

    if (editForm.middleName.trim()) {
      const midErr = validatePersonName(editForm.middleName, "Middle Name");
      if (midErr) errors.middleName = midErr;
    }

    const lastErr = validatePersonName(editForm.lastName, "Last Name", { required: true });
    if (lastErr) errors.lastName = lastErr;

    if (editForm.address.trim()) {
      const addrErr = validateAddressText(editForm.address, "Residential Address");
      if (addrErr) errors.address = addrErr;
    }

    if (editForm.emergencyContactName.trim()) {
      const emergNameErr = validatePersonName(editForm.emergencyContactName, "Emergency Contact Name");
      if (emergNameErr) errors.emergencyContactName = emergNameErr;
    }

    if (editForm.emergencyContactRelationship.trim()) {
      const emergRelErr = validateStandardText(editForm.emergencyContactRelationship, "Emergency Contact Relationship");
      if (emergRelErr) errors.emergencyContactRelationship = emergRelErr;
    }

    if (editForm.position.trim()) {
      const posErr = validateStandardText(editForm.position, "Position");
      if (posErr) errors.position = posErr;
    }

    if (editForm.department.trim()) {
      const deptErr = validateStandardText(editForm.department, "Department");
      if (deptErr) errors.department = deptErr;
    }

    if (editForm.mobileNumber.trim()) {
      const phoneErr = validatePhilippineContactPhone(editForm.mobileNumber);
      if (phoneErr) errors.mobileNumber = phoneErr;
    }

    if (editForm.sss.trim()) {
      const sssErr = validateSSSNumber(editForm.sss);
      if (sssErr) errors.sss = sssErr;
    }

    if (editForm.philhealth.trim()) {
      const phErr = validatePhilHealthNumber(editForm.philhealth);
      if (phErr) errors.philhealth = phErr;
    }

    if (editForm.pagibig.trim()) {
      const pagibigErr = validatePagIbigNumber(editForm.pagibig);
      if (pagibigErr) errors.pagibig = pagibigErr;
    }

    if (editForm.tin.trim()) {
      const tinErr = validateTINNumber(editForm.tin);
      if (tinErr) errors.tin = tinErr;
    }

    if (editForm.emergencyContactPhone.trim()) {
      const emergPhoneErr = validateEmergencyPhone(editForm.emergencyContactPhone);
      if (emergPhoneErr) errors.emergencyContactPhone = emergPhoneErr;
    }

    if (Object.keys(errors).length > 0) {
      setEditFormErrors(errors);
      const firstError = Object.values(errors)[0];
      notify.error("Validation error", firstError || "Please correct the highlighted fields before saving.");
      return;
    }

    setEditFormErrors({});

    updateDetailsMutation.mutate({
      firstName: editForm.firstName.trim(),
      middleName: editForm.middleName.trim() || null,
      lastName: editForm.lastName.trim(),
      mobileNumber: editForm.mobileNumber.trim() || null,
      address: editForm.address.trim() || null,
      city: editForm.city.trim() || null,
      province: editForm.province.trim() || null,
      barangay: editForm.barangay.trim() || null,
      postalCode: editForm.postalCode.trim() || null,
      sss: editForm.sss.trim() || null,
      philhealth: editForm.philhealth.trim() || null,
      pagibig: editForm.pagibig.trim() || null,
      tin: editForm.tin.trim() || null,
      emergencyContactName: editForm.emergencyContactName.trim() || null,
      emergencyContactRelationship: editForm.emergencyContactRelationship.trim() || null,
      emergencyContactPhone: editForm.emergencyContactPhone.trim() || null,
      emergencyContactAddress: editForm.emergencyContactAddress.trim() || null,
      position: editForm.position.trim() || null,
      department: editForm.department.trim() || null,
    });
  };

  return (
      <Dialog
        open={open}
        onClose={onClose}
        title="Edit employee details"
        description={`Update legal name, contact, statutory IDs, and job details for ${empName}`}
        size="xl"
      >
        <form onSubmit={handleSaveEdit} className="space-y-6">
          {/* Section 1: Legal Name */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-1.5">
              Legal Name
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="First Name"
                nameInput
                required
                maxLength={100}
                value={editForm.firstName}
                error={editFormErrors.firstName}
                onChange={(e) => {
                  setEditForm((prev) => ({ ...prev, firstName: e.target.value }));
                  if (editFormErrors.firstName) setEditFormErrors((err) => ({ ...err, firstName: "" }));
                }}
                placeholder="First name"
              />
              <Input
                label="Middle Name"
                nameInput
                maxLength={100}
                value={editForm.middleName}
                onChange={(e) => setEditForm((prev) => ({ ...prev, middleName: e.target.value }))}
                placeholder="Middle name (optional)"
              />
              <Input
                label="Last Name"
                nameInput
                required
                maxLength={100}
                value={editForm.lastName}
                error={editFormErrors.lastName}
                onChange={(e) => {
                  setEditForm((prev) => ({ ...prev, lastName: e.target.value }));
                  if (editFormErrors.lastName) setEditFormErrors((err) => ({ ...err, lastName: "" }));
                }}
                placeholder="Last name"
              />
            </div>
          </div>

          {/* Section 2: Contact & Location */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-1.5">
              Contact & Location
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <PhoneInput
                label="Contact Mobile"
                value={editForm.mobileNumber}
                mobileOnly
                error={editFormErrors.mobileNumber}
                onChange={(value) => {
                  setEditForm((prev) => ({ ...prev, mobileNumber: value }));
                  if (editFormErrors.mobileNumber) setEditFormErrors((err) => ({ ...err, mobileNumber: "" }));
                }}
                placeholder="0917-123-4567"
                helperText="e.g. 0917-123-4567"
              />
            </div>
            <div>
              <Input
                label="Residential Address"
                maxLength={500}
                value={editForm.address}
                onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                placeholder="Street address, building, or barangay"
              />
            </div>
            <PhilippineAddressFields
              province={editForm.province}
              city={editForm.city}
              barangay={editForm.barangay}
              postalCode={editForm.postalCode}
              onChange={(patch) => setEditForm((previous) => ({ ...previous, ...patch }))}
            />
          </div>

          {/* Section 3: Statutory Identification */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-1.5">
              Statutory Identification
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Input
                label="SSS Number"
                value={editForm.sss}
                maxLength={12}
                inputMode="numeric"
                error={editFormErrors.sss}
                onChange={(e) => {
                  const val = formatSSSNumber(e.target.value);
                  setEditForm((prev) => ({ ...prev, sss: val }));
                  if (editFormErrors.sss) setEditFormErrors((err) => ({ ...err, sss: "" }));
                }}
                placeholder="01-2345678-9"
                helperText="e.g. 01-2345678-9 (10 digits)"
              />
              <Input
                label="PhilHealth PIN"
                value={editForm.philhealth}
                maxLength={14}
                inputMode="numeric"
                error={editFormErrors.philhealth}
                onChange={(e) => {
                  const val = formatPhilHealthNumber(e.target.value);
                  setEditForm((prev) => ({ ...prev, philhealth: val }));
                  if (editFormErrors.philhealth) setEditFormErrors((err) => ({ ...err, philhealth: "" }));
                }}
                placeholder="01-234567890-1"
                helperText="e.g. 01-234567890-1 (12 digits)"
              />
              <Input
                label="Pag-IBIG MID"
                value={editForm.pagibig}
                maxLength={14}
                inputMode="numeric"
                error={editFormErrors.pagibig}
                onChange={(e) => {
                  const val = formatPagIbigNumber(e.target.value);
                  setEditForm((prev) => ({ ...prev, pagibig: val }));
                  if (editFormErrors.pagibig) setEditFormErrors((err) => ({ ...err, pagibig: "" }));
                }}
                placeholder="1234-5678-9012"
                helperText="e.g. 1234-5678-9012 (12 digits)"
              />
              <Input
                label="TIN Number"
                value={editForm.tin}
                maxLength={15}
                inputMode="numeric"
                error={editFormErrors.tin}
                onChange={(e) => {
                  const val = formatTINNumber(e.target.value);
                  setEditForm((prev) => ({ ...prev, tin: val }));
                  if (editFormErrors.tin) setEditFormErrors((err) => ({ ...err, tin: "" }));
                }}
                placeholder="123-456-789-000"
                helperText="e.g. 123-456-789-000 (9 or 12 digits)"
              />
            </div>
          </div>

          {/* Section 4: Emergency Contact */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-1.5">
              Emergency Contact
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Contact Name"
                nameInput
                value={editForm.emergencyContactName}
                onChange={(e) => setEditForm((prev) => ({ ...prev, emergencyContactName: e.target.value }))}
                placeholder="Full name"
              />
              <Input
                label="Relationship"
                value={editForm.emergencyContactRelationship}
                onChange={(e) => setEditForm((prev) => ({ ...prev, emergencyContactRelationship: e.target.value }))}
                placeholder="Relationship (e.g. Spouse)"
              />
              <PhoneInput
                label="Contact Phone"
                value={editForm.emergencyContactPhone}
                mobileOnly
                error={editFormErrors.emergencyContactPhone}
                onChange={(val) => {
                  setEditForm((prev) => ({ ...prev, emergencyContactPhone: val }));
                  if (editFormErrors.emergencyContactPhone) setEditFormErrors((err) => ({ ...err, emergencyContactPhone: "" }));
                }}
                placeholder="0917-123-4567"
                helperText="e.g. 0917-123-4567"
              />
            </div>
            <div>
              <Input
                label="Emergency Contact Address"
                value={editForm.emergencyContactAddress}
                onChange={(e) => setEditForm((prev) => ({ ...prev, emergencyContactAddress: e.target.value }))}
                placeholder="Address (optional)"
              />
            </div>
          </div>

          {/* Section 5: Job Assignment */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-1.5">
              Job Assignment
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Position"
                value={editForm.position}
                onChange={(e) => setEditForm((prev) => ({ ...prev, position: e.target.value }))}
                placeholder="Job title / position"
              />
              <Input
                label="Department"
                value={editForm.department}
                onChange={(e) => setEditForm((prev) => ({ ...prev, department: e.target.value }))}
                placeholder="Department"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={updateDetailsMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={updateDetailsMutation.isPending}
            >
              Save changes
            </Button>
          </div>
        </form>
      </Dialog>
  );
};
