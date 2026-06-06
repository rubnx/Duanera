"use client"

import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"

function ExplorerSubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button
      aria-live="polite"
      loading={pending}
      loadingLabel="Aplicando filtros"
      size="product-sm"
      type="submit"
      variant="primary"
    >
      {pending ? "Aplicando..." : "Aplicar"}
    </Button>
  )
}

export { ExplorerSubmitButton }
