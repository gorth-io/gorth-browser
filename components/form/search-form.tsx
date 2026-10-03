import { useForm } from "@tanstack/react-form";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Search, ArrowRight } from "lucide-react";

export function SearchForm({ onSubmit }: { onSubmit: (value: string) => void }) {
  const form = useForm({
    defaultValues: { query: "" },
    onSubmit: async ({ value }) => {
      const query = value.query.trim();
      if (query) onSubmit(query);
    },
  });
  return (
    <form
      className="mx-auto mt-8 max-w-2xl"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="query">
        {(field) => (
          <InputGroup className="h-12 rounded-xl bg-card shadow-lg shadow-foreground/5">
            <InputGroupAddon className="pl-4"><Search className="size-4" /></InputGroupAddon>
            <InputGroupInput
              aria-label="Search or enter address"
              autoFocus
              className="text-base"
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="Search or enter address..."
              value={field.state.value}
            />
            <InputGroupAddon align="inline-end" className="pr-2">
              <InputGroupButton aria-label="Open page" size="icon-sm" type="submit" variant="default"><ArrowRight /></InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        )}
      </form.Field>
    </form>
  );
}
