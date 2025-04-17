using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PurchaseOrderSystem.BLL;
using PurchaseOrderSystem.DAL;

namespace PurchaseOrderSystem
{
	public static class BackendExtensions
	{
		public static void AddBackendDependencies(this IServiceCollection services, Action<DbContextOptionsBuilder> options)
		{
			services.AddDbContext<eBike_2025_PO_Context>(options);

			services.AddTransient<PurchaseOrderService>((serviceProvider) =>
			{
				var context = serviceProvider.GetService<eBike_2025_PO_Context>();

				return new PurchaseOrderService(context);
			});

		}
	}
}
