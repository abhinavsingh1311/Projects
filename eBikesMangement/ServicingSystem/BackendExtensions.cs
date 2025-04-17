using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SalesReturnSystem.BLL;
using ServicingSystem.DAL;


namespace ServicingSystem
{
	public static class BackendExtensions
	{
		public static void AddBackendDependencies(this IServiceCollection services, Action<DbContextOptionsBuilder> options)
		{
			services.AddDbContext<eBike_2025_Servicing_Context>(options);

			services.AddTransient<ServicingService>((serviceProvider) =>
			{
				var context = serviceProvider.GetService<eBike_2025_Servicing_Context>();

				return new ServicingService(context);
			});

		}
	}
}
