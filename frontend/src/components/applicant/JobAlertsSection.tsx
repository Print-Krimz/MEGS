import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input } from "../ui";
import { ErrorState, LoadingState } from "../common";
import { applicantApi, type JobAlertEmail, type JobAlertSettings } from "../../lib/api/applicant.api";
import { notify } from "../../lib/feedback";

const KEY = ["applicant", "job-alerts"] as const;

const EMAIL_CHOICES: Array<{ value: JobAlertEmail; label: string; hint: string }> = [
  { value: "WEEKLY", label: "Weekly", hint: "One email a week, only when new jobs match you." },
  { value: "DAILY", label: "Daily", hint: "An email on days when new jobs match you." },
  { value: "OFF", label: "Off", hint: "No job emails." },
];

const MAX_SALARY = 1_000_000;

/** Applicant settings: how often to hear about matching jobs, and the pay they expect. */
export const JobAlertsSection: React.FC = () => {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: KEY, queryFn: applicantApi.getJobAlerts });
  const [salary, setSalary] = useState("");

  useEffect(() => {
    if (query.data) setSalary(query.data.expectedMonthlySalary ? String(query.data.expectedMonthlySalary) : "");
  }, [query.data]);

  const save = useMutation({
    mutationFn: applicantApi.updateJobAlerts,
    onSuccess: (settings: JobAlertSettings) => {
      queryClient.setQueryData(KEY, settings);
      // Salary and alerts change which jobs are recommended.
      queryClient.invalidateQueries({ queryKey: ["applicant", "recommendations"] });
      notify.success("Job alert settings saved");
    },
    onError: (err: unknown) => notify.error("Could not save your settings", err),
  });

  const salaryDigits = salary.trim();
  const salaryValue = salaryDigits === "" ? null : Number(salaryDigits);
  const salaryInvalid = salaryValue !== null && (!Number.isInteger(salaryValue) || salaryValue < 1 || salaryValue > MAX_SALARY);
  const salaryChanged = (salaryValue ?? null) !== (query.data?.expectedMonthlySalary ?? null);

  return (
    <section aria-labelledby="job-alerts-heading" className="space-y-2">
      <h2 id="job-alerts-heading" className="text-base font-semibold text-slate-900">Job alerts</h2>
      <div className="overflow-hidden rounded-md border border-slate-300 bg-white">
        {query.isLoading ? (
          <LoadingState variant="spinner" />
        ) : query.isError || !query.data ? (
          <ErrorState subject="job alert settings" error={query.error} onRetry={() => query.refetch()} compact />
        ) : (
          <div className="divide-y divide-slate-200">
            <fieldset className="space-y-3 px-4 py-4 sm:px-5" disabled={save.isPending || !query.data.hasEmail}>
              <legend className="text-sm font-medium text-slate-700">Email me about matching jobs</legend>
              {!query.data.hasEmail && (
                <p className="text-sm text-slate-600">Your account has no email address, so job emails cannot be sent.</p>
              )}
              <div className="space-y-1">
                {EMAIL_CHOICES.map((choice) => (
                  <label key={choice.value} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-navy-soft">
                    <input
                      type="radio"
                      name="job-alert-email"
                      className="mt-1 size-4 accent-navy"
                      checked={query.data.email === choice.value}
                      onChange={() => save.mutate({ email: choice.value })}
                    />
                    <span className="text-sm">
                      <span className="font-medium text-slate-900">{choice.label}</span>
                      <span className="block text-slate-600">{choice.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="px-4 py-4 sm:px-5">
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-navy-soft">
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-navy"
                  checked={query.data.sms}
                  disabled={save.isPending || (!query.data.sms && !query.data.smsPhone)}
                  onChange={(event) => save.mutate({ sms: event.target.checked })}
                />
                <span className="text-sm">
                  <span className="font-medium text-slate-900">Also text me</span>
                  <span className="block text-slate-600">
                    {query.data.smsPhone
                      ? `At most one text a week, to ${query.data.smsPhone}. Turn this off here any time.`
                      : "Add a Philippine mobile number to your profile to get texts."}
                  </span>
                </span>
              </label>
            </div>

            <form
              className="space-y-2 px-4 py-4 sm:px-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (!salaryInvalid) save.mutate({ expectedMonthlySalary: salaryValue });
              }}
            >
              <Input
                label="Expected monthly salary (₱)"
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_SALARY}
                step={500}
                value={salary}
                onChange={(event) => setSalary(event.target.value)}
                error={salaryInvalid ? `Enter a whole amount from ₱1 to ₱${MAX_SALARY.toLocaleString("en-PH")}.` : undefined}
                helperText="Optional. Jobs that pay less than this are shown last and left out of emails."
              />
              <Button type="submit" variant="outline" size="md" disabled={!salaryChanged || salaryInvalid} loading={save.isPending}>
                Save salary
              </Button>
            </form>
          </div>
        )}
      </div>
    </section>
  );
};
