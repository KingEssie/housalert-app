import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CreditCard, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

const MOCK_METHODS: PaymentMethod[] = [
  {
    id: "pm_1",
    brand: "Visa",
    last4: "4242",
    expMonth: 8,
    expYear: 27,
    isDefault: true,
  },
];

export default function PaymentMethodPage() {
  const { toast } = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>(MOCK_METHODS);

  const handleAdd = () => {
    toast({
      title: "Binnenkort beschikbaar",
      description: "Betaalmethode toevoegen wordt binnenkort ondersteund.",
    });
  };

  const handleRemove = (id: string) => {
    if (methods.length <= 1) {
      toast({
        title: "Niet mogelijk",
        description: "Je hebt minimaal één betaalmethode nodig.",
        variant: "destructive",
      });
      return;
    }
    setMethods((prev) => prev.filter((m) => m.id !== id));
    toast({
      title: "Verwijderd",
      description: "Betaalmethode is verwijderd.",
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]" data-testid="page-payment-method">
      <PageHeader title="Betaalmethode" />

      <div className="max-w-xl mx-auto p-4 space-y-4 pb-8">
        <div className="bg-white rounded-[18px] border border-[#E5E7EB] overflow-hidden">
          <div className="px-5 pt-5 pb-2">
            <p className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wider" data-testid="text-section-title-payment">
              Huidige betaalmethode
            </p>
          </div>

          {methods.map((method) => (
            <div key={method.id} className="px-5 py-4" data-testid={`card-payment-${method.id}`}>
              <div className="flex items-center gap-3">
                <div className="w-[48px] h-[48px] rounded-[12px] bg-[#DCDBFA] flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-5 h-5 text-[#673DE5]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] font-semibold text-[#111827]" data-testid="text-card-brand">
                    {method.brand} •••• {method.last4}
                  </p>
                  <p className="text-[14px] text-[#6B7280]" data-testid="text-card-expiry">
                    Vervalt {String(method.expMonth).padStart(2, "0")}/{method.expYear}
                  </p>
                </div>
                {method.isDefault && (
                  <span
                    className="text-[12px] font-[600] px-2.5 py-1 rounded-full bg-[#8BEA63] text-[#111827] flex-shrink-0"
                    data-testid="badge-default"
                  >
                    Standaard
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-[18px] border border-[#E5E7EB] overflow-hidden">
          <button
            onClick={handleAdd}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[#F8FAFC] transition-colors"
            data-testid="button-add-payment"
          >
            <div className="w-10 h-10 rounded-xl bg-[#DCDBFA] flex items-center justify-center flex-shrink-0">
              <Plus className="w-5 h-5 text-[#673DE5]" />
            </div>
            <span className="text-[15px] font-medium text-[#111827]">Betaalmethode toevoegen</span>
          </button>
          <div className="mx-5 border-b border-[#E5E7EB]" />
          <button
            onClick={() => methods.length > 0 && handleRemove(methods[0].id)}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[#F8FAFC] transition-colors"
            data-testid="button-remove-payment"
          >
            <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-5 h-5 text-[#6B7280]" />
            </div>
            <span className="text-[15px] font-medium text-[#673DE5]">Betaalmethode verwijderen</span>
          </button>
        </div>
      </div>
    </div>
  );
}
