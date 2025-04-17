using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ReceivingSystem.BLL;
using ReceivingSystem.DAL;

namespace ReceivingSystem
{
	public static class BackendExtensions
	{
		public static void AddBackendDependencies(this IServiceCollection services, Action<DbContextOptionsBuilder> options)
		{
			services.AddDbContext<eBike_2025Context>(options);

			services.AddTransient<ReceivingService>((serviceProvider) =>
			{
				var context = serviceProvider.GetService<eBike_2025Context>();

				return new ReceivingService(context);
			});

		}
	}
}
