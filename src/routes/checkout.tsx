import { useEffect, useState } from "react";
import { useNavigate, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createCheckout } from "@/lib/checkout.functions";
import { useCart } from "@/context/CartContext";

export const Route = createFileRoute("/checkout")({
  meta: () => [{ title: "Cart" }],
  component: Checkout,
});

function Checkout() {
  const navigate = useNavigate();
  const submit = useServerFn(createCheckout);
  const { items, totalCents, updateItemQuantity, removeItem } = useCart();
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "", lastName: "", email: "", address: "", apt: "", 
    city: "", state: "", zip: "", phone: ""
  });

  useEffect(() => {
    document.title = "Cart";
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    
    setLoading(true);
    try {
      const res = await submit({
        data: { 
          name: `${formData.firstName} ${formData.lastName}`, 
          email: formData.email, 
          items: items.map(i => ({ 
            productId: i.productId, 
            variantSku: i.variantSku, 
            quantity: i.quantity 
          })) 
        },
      });
      
      if (res?.redirectUrl) window.location.href = res.redirectUrl;
      else if (res?.error) toast.error(res.error);
    } catch { 
      toast.error("Checkout failed."); 
    } finally { 
      setLoading(false); 
    }
  }

  const Input = ({ placeholder, name }: any) => (
    <input 
      required
      placeholder={placeholder}
      className="w-full border-b border-black dark:border-white/20 bg-transparent py-3 text-sm outline-none placeholder:text-gray-400 uppercase tracking-widest"
      onChange={(e) => setFormData({...formData, [name]: e.target.value})}
    />
  );

  return (
    <section className="bg-background text-foreground min-h-screen py-12 px-6">
      <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-20">
        
        {/* LEFT: Forms */}
        <form onSubmit={onSubmit} className="space-y-12">
          
          <div className="space-y-4">
            <h2 className="text-xs font-bold tracking-widest uppercase">Contact Information</h2>
            <Input placeholder="Email Address" name="email" />
            <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest cursor-pointer">
              <input type="checkbox" className="accent-foreground" /> Subscribe to updates and notifications
            </label>
          </div>

          <div className="space-y-4">
            <h2 className="text-xs font-bold tracking-widest uppercase">Shipping Address</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input placeholder="First Name" name="firstName" />
              <Input placeholder="Last Name" name="lastName" />
            </div>
            <Input placeholder="Address" name="address" />
            <Input placeholder="Apartment, Suite, Unit, etc. (Optional)" name="apt" />
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1"><Input placeholder="City" name="city" /></div>
              <div className="col-span-1">
                <select className="w-full border-b border-black dark:border-white/20 bg-transparent py-3 text-sm outline-none uppercase tracking-widest">
                  <option>State</option>
                  <option>TX</option>
                </select>
              </div>
              <div className="col-span-1"><Input placeholder="Zip" name="zip" /></div>
            </div>
            <Input placeholder="Phone Number" name="phone" />
          </div>

          <button 
            type="submit" 
            disabled={loading || items.length === 0} 
            className="w-full bg-foreground text-background py-4 font-bold uppercase tracking-widest hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin mx-auto" /> : "Complete Purchase"}
          </button>
        </form>

        {/* RIGHT: Order Summary */}
        <aside className="space-y-8">
          <h2 className="text-xs font-bold tracking-widest uppercase">Order Summary</h2>
          
          <div className="space-y-6">
            {items.map((item) => {
              // Priority resolution for the image key
              const imageUrl = item.image_url || item.image || item.src;

              return (
                <div key={`${item.productId}-${item.variantSku}`} className="flex items-center gap-4 border-b border-black/10 pb-4">
                  
                  {/* Transparent Product Image */}
                  <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center">
                    {imageUrl && (
                      <img 
                        src={imageUrl} 
                        alt={item.title} 
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="flex-grow">
                    <p className="text-sm font-bold uppercase">{item.title}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Qty: {item.quantity}</p>
                  </div>

                  {/* Price + Controls */}
                  <div className="text-right space-y-2">
                    <p className="text-sm font-bold">${((item.price_cents * item.quantity) / 100).toFixed(0)}</p>
                    <div className="flex items-center justify-end gap-3 text-xs">
                      <button type="button" onClick={() => updateItemQuantity(item.productId, item.quantity - 1, item.variantSku)} className="hover:underline opacity-60"> - </button>
                      <span className="font-mono">{item.quantity}</span>
                      <button type="button" onClick={() => updateItemQuantity(item.productId, item.quantity + 1, item.variantSku)} className="hover:underline opacity-60"> + </button>
                      <button type="button" onClick={() => removeItem(item.productId, item.variantSku)} className="hover:underline text-red-500 ml-3">Remove</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-black dark:border-white pt-6 space-y-2 uppercase tracking-widest text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>${(totalCents / 100).toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Shipping</span>
              <span>Calculated at next step</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-4">
              <span>Total</span>
              <span>${(totalCents / 100).toFixed(0)}</span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
