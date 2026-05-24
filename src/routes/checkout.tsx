import { createFileRoute, Link } from "@tanstack/react-router";
import { useCart } from "@/context/CartContext";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});

function CheckoutPage() {
  const { items, updateItemQuantity, removeItem, totalCents } = useCart();

  return (
    <div className="min-h-screen bg-background text-foreground font-mono px-4 py-8 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl font-bold uppercase tracking-widest mb-8">Checkout</h1>

        {/* --- MOBILE VIEW (Only visible on small screens) --- */}
        <div className="md:hidden space-y-6">
          {items.map((item) => (
            <div key={`${item.productId}-${item.variantSku}`} className="flex gap-4 border-b border-border pb-4">
              {/* Image - no border */}
              <div className="w-20 h-20 flex-shrink-0 overflow-hidden">
                <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
              </div>

              {/* Info */}
              <div className="flex flex-col flex-1 gap-1 min-w-0">
                <h3 className="text-sm font-bold uppercase leading-tight">{item.title}</h3>
                <p className="text-xs opacity-70">${(item.price_cents / 100).toFixed(2)} each</p>

                {/* Controls */}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center border border-border">
                    <button onClick={() => updateItemQuantity(item.productId, item.quantity - 1, item.variantSku)} className="px-3 py-1 text-xs hover:bg-muted">-</button>
                    <span className="px-3 text-xs">{item.quantity}</span>
                    <button onClick={() => updateItemQuantity(item.productId, item.quantity + 1, item.variantSku)} className="px-3 py-1 text-xs hover:bg-muted">+</button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold">${((item.price_cents * item.quantity) / 100).toFixed(2)}</span>
                    <button onClick={() => removeItem(item.productId, item.variantSku)} className="text-[10px] uppercase underline opacity-50">Remove</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* --- DESKTOP VIEW (Only visible on medium screens and up) --- */}
        <div className="hidden md:block">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="pb-4 uppercase text-xs tracking-widest">Product</th>
                <th className="pb-4 uppercase text-xs tracking-widest">Quantity</th>
                <th className="pb-4 uppercase text-xs tracking-widest">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.productId}-${item.variantSku}`} className="border-t border-border">
                  <td className="py-4">{item.title}</td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateItemQuantity(item.productId, item.quantity - 1, item.variantSku)}>-</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateItemQuantity(item.productId, item.quantity + 1, item.variantSku)}>+</button>
                    </div>
                  </td>
                  <td className="py-4">${((item.price_cents * item.quantity) / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* --- SUMMARY SECTION (Works for both) --- */}
        <div className="mt-12 border-t border-border pt-6">
          <div className="flex justify-between items-center text-sm font-bold uppercase tracking-widest">
            <span>Total</span>
            <span>${(totalCents / 100).toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
