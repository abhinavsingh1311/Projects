using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SalesReturnSystem.BLL;
using SalesReturnSystem.DAL;

namespace SalesReturnSystem
{
	public static class BackendExtensions
	{
		public static void AddBackendDependencies(this IServiceCollection services, Action<DbContextOptionsBuilder> options)
		{
			services.AddDbContext<eBike_2025_SR_Context>(options);

			services.AddTransient<SalesReturnService>((serviceProvider) =>
			{
				var context = serviceProvider.GetService<eBike_2025_SR_Context>();

				return new SalesReturnService(context);
			});

		}
	}
}
