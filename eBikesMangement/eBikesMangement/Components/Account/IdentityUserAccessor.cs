using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using eBikesMangement.Data;

namespace eBikesMangement.Components.Account;

internal sealed class IdentityUserAccessor(UserManager<ApplicationUser> userManager, IdentityRedirectManager redirectManager)
{
	public async Task<ApplicationUser> GetRequiredUserAsync(HttpContext context)
	{
		// Check if context or context.User is null
		if (context == null || context.User == null || !context.User.Identity.IsAuthenticated)
		{
			redirectManager.RedirectToWithStatus("Account/Login", "Error: User is not authenticated or context is invalid.", context);
			return null;
		}

		var user = await userManager.GetUserAsync(context.User);

		if (user is null)
		{
			var userId = userManager.GetUserId(context.User);
			var errorMessage = string.IsNullOrEmpty(userId)
				? "Error: No user ID found in the claims."
				: $"Error: Unable to load user with ID '{userId}'.";

			redirectManager.RedirectToWithStatus("Account/InvalidUser", errorMessage, context);
			return null;
		}

		return user;
	}
}
