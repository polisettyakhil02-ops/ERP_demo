// pages/MultipleReceipts.jsx
//
// Formerly "Duplicate Receipts" - now hosts the full "Receipts" feature that
// used to live inline on BPFees.jsx (Multiple/Old/Term/Transport/Hostel Fee
// Receipt, Kit Amount, Other Income, Duplicate Print, Cancel Receipt), all
// driven by ReceiptCenterPanel. Class -> Student -> Receipt Type, in that
// order - the type is just another filter picked after Class/Student, not a
// menu picked first.
import React, { useState, useEffect } from "react";
import { branchApi } from "@/api/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ReceiptCenterPanel from "@/components/fees/ReceiptCenterPanel";

const apiErrorMessage = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.error ||
  err?.message ||
  "Something went wrong";

export default function MultipleReceipts() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Same branch-picker pattern as BPFees.jsx - Admin Officer is multi-branch
  // and needs to pick one concrete branch before ad-hoc entry/cancellation
  // (ReceiptCenterPanel's canMutate) becomes available; Accounts Manager is
  // pinned to their own branch and never sees this picker.
  const isMultiBranch = user?.role === "admin_officer";
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("all");

  const resolvedBranchId = isMultiBranch
    ? selectedBranch !== "all"
      ? selectedBranch
      : undefined
    : typeof user?.branch === "object"
      ? user?.branch?._id
      : user?.branch;

  useEffect(() => {
    if (!isMultiBranch) return;
    branchApi
      .list()
      .then((data) => setBranches(data || []))
      .catch((err) =>
        toast({
          title: "Failed to load branches",
          description: apiErrorMessage(err),
          variant: "destructive",
        }),
      );
  }, [isMultiBranch]);

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">
          Multiple Receipts
        </h2>
        <p className="text-sm text-slate-500">
          Print any fee receipt type for a student, record a one-off Kit/
          Other Income payment, or reprint/cancel a past receipt.
        </p>
      </div>

      {isMultiBranch && (
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-indigo-500" />
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-40 h-9 text-sm">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b._id} value={b._id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <ReceiptCenterPanel
        branchId={resolvedBranchId}
        canMutate={!!resolvedBranchId}
      />
    </div>
  );
}
