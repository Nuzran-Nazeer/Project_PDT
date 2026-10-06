import Icon from "./Icon";

export default function WorkflowNotice({ children, tone = "empty", className = "" }) {
  const error = tone === "error";
  return (
    <div
      role={error ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-xl border border-line bg-raised p-5 sm:p-6 ${className}`}
    >
      <span
        className={`rounded-lg bg-secondary p-2.5 ${error ? "text-danger" : "text-muted"}`}
      >
        <Icon
          name={error ? "flag" : tone === "loading" ? "clock" : "check"}
          className="h-4 w-4"
        />
      </span>
      <div
        className={`min-w-0 self-center text-sm ${error ? "text-danger" : "text-muted"}`}
      >
        {children}
      </div>
    </div>
  );
}
