import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { listOwed } from "../../services/feedback";
import PageHeader from "../../components/layout/PageHeader";
import ShellTable from "../../components/shells/ShellTable";

const STATUS_LABEL = {
  assigned: "Not started",
  draft: "Draft saved",
  submitted: "Submitted",
  locked: "Submitted",
};

export default function FeedbackOwedPage() {
  const { user } = useAuth();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    listOwed()
      .then((data) => !cancelled && setItems(data.items || []))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, []);

  const rows = items.map((item) => ({
    key: item.id,
    cells: [
      item.reviewee.name || "—",
      item.reviewee.designation || "—",
      STATUS_LABEL[item.status] || item.status,
      <Link
        key="action"
        to={`/feedback-i-owe/${item.id}`}
        className="text-sm text-brand transition-colors hover:underline"
      >
        {item.status === "assigned"
          ? "Review"
          : item.status === "draft"
            ? "Continue"
            : item.editable
              ? "Edit"
              : "View"}
      </Link>,
    ],
  }));

  return (
    <>
      <PageHeader
        title="Feedback I owe"
        context={[user?.designation, user?.name].filter(Boolean).join(" · ")}
        backTo="/dashboard"
      />

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-line bg-raised p-5 text-sm text-danger"
        >
          {error}
        </p>
      ) : loading ? (
        <p className="rounded-xl border border-line bg-raised p-5 text-sm text-muted">
          Loading…
        </p>
      ) : (
        <ShellTable
          heading="Feedback I owe"
          columns={["Colleague", "Designation", "Status", ""]}
          rows={rows}
          empty="No colleague reviews assigned to you."
        />
      )}

      <p className="mt-4 max-w-prose text-[13px] text-muted">
        A reviewer is only ever picked from people you actually worked with: four
        continuous months, at least two of them inside the cycle. The form asks the
        competencies of their job, not yours, worded for a colleague.
      </p>
    </>
  );
}
