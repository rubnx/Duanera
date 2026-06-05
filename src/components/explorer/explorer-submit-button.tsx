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
      type="submit"
      variant="primary"
      size="product-md"
    >
      {pending ? "Aplicando..." : "Aplicar"}
    </Button>
  )
}

export { ExplorerSubmitButton }
