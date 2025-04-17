using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;
using MudBlazor;
using ReceivingSystem.BLL;
using ReceivingSystem.ViewModels;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Components.Authorization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using System.Linq;
using eBikesMangement.Components;

namespace eBikesMangement.Components.Pages.Receiving
{
	//[Authorize(Roles = "PartsManager,StoreStaff")]
	[Authorize]
	public partial class ReceiveOrders
	{
		#region Fields
		// Form fields
		private string reason = string.Empty;
		private string description = string.Empty;
		private string vsn = string.Empty; //vendor serial number (vsn) for unordered items
		private int qty = 0;

		// Form state tracking
		private bool hasChanges = false;
		private MudForm receiveForm = new();
		#endregion

		#region Feedback & Error Messages
		// Error handling
		private string errorMessage = string.Empty;
		private List<string> errorDetails = new List<string>();
		private bool hasError => !string.IsNullOrWhiteSpace(errorMessage);

		// Feedback message
		private string feedbackMessage = string.Empty;
		private bool hasFeedback => !string.IsNullOrEmpty(feedbackMessage);
		#endregion

		#region Validation
		// flag to check if the form is valid
		private bool isFormValid;
		// set text for cancel/reset button
		private string resetButtonText => hasChanges ? "Cancel" : "Reset";
		#endregion

		#region Properties
		// outstanding PO collection
		private List<PurchaseOrderListViewModel> OutstandingOrders { get; set; } = new List<PurchaseOrderListViewModel>();

		// currently selected PO
		private PurchaseOrderListViewModel SelectedOrder { get; set; }

		//list containing details of the selected PO
		private List<ReceivingDetailView> OrderDetails { get; set; } = new List<ReceivingDetailView>();

		// list of unordered items
		private List<UnorderedReturnItemView> UnorderedItems { get; set; } = new List<UnorderedReturnItemView>();

		// Route parameter
		[Parameter]
		public int? OrderId { get; set; }

		[Inject] protected ReceivingService ReceivingService { get; set; }
		[Inject] protected NavigationManager NavigationManager { get; set; }
		[Inject] protected IJSRuntime JSRuntime { get; set; }
		[Inject] protected ISnackbar Snackbar { get; set; }
		[Inject] protected IDialogService DialogService { get; set; }
		[CascadingParameter] private Task<AuthenticationState> AuthenticationStateTask { get; set; }
		#endregion

		#region Methods
		//initialize correct outstanding order when the page is first loaded 
		protected override async Task OnInitializedAsync()
		{
			try
			{
				await base.OnInitializedAsync();

				// Reset error messages
				errorDetails.Clear();
				errorMessage = string.Empty;
				feedbackMessage = string.Empty;

				// Verify authentication
				var authState = await AuthenticationStateTask;
				if (!authState.User.Identity.IsAuthenticated)
				{
					NavigationManager.NavigateTo($"/Account/Login?ReturnUrl={Uri.EscapeDataString(NavigationManager.Uri)}", forceLoad: true);
					return;
				}

				//// Verify role
				//if (!authState.User.IsInRole("PartsManager") && !authState.User.IsInRole("StoreStaff"))
				//{
				//    NavigationManager.NavigateTo("/");
				//    return;
				//}

				await LoadOutstandingOrders();
				UnorderedItems = new List<UnorderedReturnItemView>();

				if (OrderId.HasValue && OrderId.Value > 0)
				{
					await ViewOrder(OrderId.Value);
				}

				StateHasChanged();
			}
			catch (ArgumentNullException ex)
			{
				errorMessage = BlazorHelperClass.GetInnerException(ex).Message;
			}
			catch (ArgumentException ex)
			{
				errorMessage = BlazorHelperClass.GetInnerException(ex).Message;
			}
			catch (AggregateException ex)
			{
				//  have a collection of errors
				//  each error should be placed into a separate line
				if (!string.IsNullOrWhiteSpace(errorMessage))
				{
					errorMessage = $"{errorMessage}{Environment.NewLine}";
				}

				errorMessage = $"{errorMessage}Error initializing page";
				foreach (var error in ex.InnerExceptions)
				{
					errorDetails.Add(error.Message);
				}
			}
			catch (Exception ex)
			{
				errorMessage = "Error initializing page";
				errorDetails.Add(BlazorHelperClass.GetInnerException(ex).Message);
			}
		}

		// ensures correct order loads when params change (loads individual order details)
		protected override async Task OnParametersSetAsync()
		{
			if (OrderId.HasValue && OrderId.Value > 0)
			{
				if (SelectedOrder == null || SelectedOrder.PurchaseOrderID != OrderId.Value)
				{
					await ViewOrder(OrderId.Value);
				}
			}

			await base.OnParametersSetAsync();
		}

		//loads all non-closed outstanding PO from bll 
		private async Task LoadOutstandingOrders()
		{
			try
			{
				OutstandingOrders = ReceivingService.GetOutstandingOrders();
				StateHasChanged();
			}
			catch (ArgumentNullException ex)
			{
				errorMessage = BlazorHelperClass.GetInnerException(ex).Message;
			}
			catch (ArgumentException ex)
			{
				errorMessage = BlazorHelperClass.GetInnerException(ex).Message;
			}
			catch (AggregateException ex)
			{
				//  have a collection of errors
				if (!string.IsNullOrWhiteSpace(errorMessage))
				{
					errorMessage = $"{errorMessage}{Environment.NewLine}";
				}

				errorMessage = $"{errorMessage}Failed to load outstanding orders";
				foreach (var error in ex.InnerExceptions)
				{
					errorDetails.Add(error.Message);
				}
			}
			catch (Exception ex)
			{
				errorMessage = "Failed to load outstanding orders";
				errorDetails.Add(BlazorHelperClass.GetInnerException(ex).Message);
			}
		}

		// loads and display details for a specific PO
		// param : orderid 
		// finally clears any unordered items
		private async Task ViewOrder(int orderId)
		{
			try
			{
				// Reset error messages
				errorDetails.Clear();
				errorMessage = string.Empty;
				feedbackMessage = string.Empty;

				// if there are unsaved changes
				if (hasChanges)
				{
					bool? result = await DialogService.ShowMessageBox(
						"Unsaved Changes",
						"You have unsaved changes. Do you want to continue?",
						yesText: "Yes", cancelText: "No");

					if (result == null)
					{
						return;
					}
				}

				SelectedOrder = OutstandingOrders.FirstOrDefault(o => o.PurchaseOrderID == orderId);

				if (SelectedOrder != null)
				{
					// Load order details
					OrderDetails = ReceivingService.GetReceivingOrderDetails(orderId);

					// Clear unordered items
					UnorderedItems = new List<UnorderedReturnItemView>();

					// Check if there's any activity already
					isFormValid = OrderDetails.Any(d => d.Received > 0 || d.Returned > 0);

					// Clear form fields
					ClearFormFields();

					// Reset change tracking
					hasChanges = false;
					isFormValid = false;
					receiveForm.ResetTouched();

					StateHasChanged();
				}
				else
				{
					throw new Exception($"Purchase order with ID {orderId} was not found.");
				}
			}
			catch (ArgumentNullException ex)
			{
				errorMessage = BlazorHelperClass.GetInnerException(ex).Message;
			}
			catch (ArgumentException ex)
			{
				errorMessage = BlazorHelperClass.GetInnerException(ex).Message;
			}
			catch (AggregateException ex)
			{
				//  have a collection of errors
				if (!string.IsNullOrWhiteSpace(errorMessage))
				{
					errorMessage = $"{errorMessage}{Environment.NewLine}";
				}

				errorMessage = $"{errorMessage}Error loading order details";
				foreach (var error in ex.InnerExceptions)
				{
					errorDetails.Add(error.Message);
				}
			}
			catch (Exception ex)
			{
				errorMessage = $"Error loading order details for PO #{orderId}";
				errorDetails.Add(BlazorHelperClass.GetInnerException(ex).Message);
			}
		}

		// Get the current employee ID from authentication
		private async Task<string> GetCurrentEmployeeIdAsync()
		{
			var authState = await AuthenticationStateTask;
			return authState.User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "unknown";
		}

		// Check if the current user has the PartsManager role
		private async Task<bool> IsManagerAsync()
		{
			var authState = await AuthenticationStateTask;
			return authState.User.Identity.IsAuthenticated;
			//return authState.User.IsInRole("PartsManager");
		}

		private void ClearFormFields()
		{
			reason = string.Empty;
			description = string.Empty;
			vsn = string.Empty;
			qty = 0;
		}

		private void ClearMessages()
		{
			errorMessage = string.Empty;
			errorDetails.Clear();
			feedbackMessage = string.Empty;
		}

		/*
         validates all inputs are correct for order details
         */
		private bool ValidateOrderDetails()
		{
			bool isValid = true;
			errorDetails.Clear();

			foreach (var detail in OrderDetails)
			{
				//  received quantity doesn't exceed outstanding
				if (detail.Received > detail.Outstanding)
				{
					errorDetails.Add($"Part {detail.PartID} ({detail.Description}): Received quantity ({detail.Received}) cannot exceed outstanding quantity ({detail.Outstanding}).");
					isValid = false;
				}

				//  positive values only
				if (detail.Received < 0)
				{
					errorDetails.Add($"Part {detail.PartID} ({detail.Description}): Received quantity must be a positive value.");
					isValid = false;
				}

				if (detail.Returned < 0)
				{
					errorDetails.Add($"Part {detail.PartID} ({detail.Description}): Returned quantity must be a positive value.");
					isValid = false;
				}

				// Ensures a reason for returns
				if (detail.Returned > 0 && string.IsNullOrWhiteSpace(detail.ReturnReason))
				{
					errorDetails.Add($"Part {detail.PartID} ({detail.Description}): A reason must be provided for returned items.");
					isValid = false;
				}
			}

			return isValid;
		}

		/*
         validates all inputs are correct for unordered item details
         */
		private bool ValidateUnorderedItems()
		{
			bool isValid = true;

			foreach (var item in UnorderedItems)
			{
				if (string.IsNullOrWhiteSpace(item.Description))
				{
					errorDetails.Add("Unordered item: Description is required.");
					isValid = false;
				}

				if (string.IsNullOrWhiteSpace(item.VendorSerialNumber))
				{
					errorDetails.Add("Unordered item: Vendor Serial Number is required.");
					isValid = false;
				}

				if (item.Quantity <= 0)
				{
					errorDetails.Add("Unordered item: Quantity must be greater than zero.");
					isValid = false;
				}
			}

			return isValid;
		}

		/*
         * processes the receiving of a PO
         * 1.checks all inputs
         * 2. there should be at least one item passed as received or returned
         * 3. updates the UI accordingly
         * 4. refreshes the list of non closed orders
         */
		private async Task ReceiveOrder()
		{
			try
			{
				ClearMessages();

				// Check authentication
				var authState = await AuthenticationStateTask;
				if (!authState.User.Identity.IsAuthenticated)
				{
					errorMessage = "You must be logged in to perform this action.";
					NavigationManager.NavigateTo("/Account/Login");
					return;
				}

				// Validate inputs
				if (!ValidateOrderDetails())
				{
					errorMessage = "Validation errors found. Please correct them before proceeding.";
					return;
				}

				if (!ValidateUnorderedItems())
				{
					errorMessage = "Validation errors found in unordered items. Please correct them before proceeding.";
					return;
				}

				// Check if any items are being received or returned
				bool hasActivity = false;
				foreach (var item in OrderDetails)
				{
					if (item.Received > 0 || item.Returned > 0)
					{
						hasActivity = true;
						break;
					}
				}

				if (!hasActivity && UnorderedItems.Count == 0)
				{
					errorMessage = "No items have been received or returned.";
					return;
				}

				// Get current user ID
				string employeeId = await GetCurrentEmployeeIdAsync();

				// Process the receiving
				ReceivingService.ProcessReceiving(
					SelectedOrder.PurchaseOrderID,
					employeeId,
					OrderDetails,
					UnorderedItems,
					reason);

				feedbackMessage = $"Successfully processed receiving for PO #{SelectedOrder.PurchaseOrderNumber}.";
				Snackbar.Add(feedbackMessage, Severity.Success);

				// Refresh the order list
				await LoadOutstandingOrders();

				// Check if the order has been closed
				var updatedOrder = ReceivingService.GetPurchaseOrderByID(SelectedOrder.PurchaseOrderID);
				if (updatedOrder == null || updatedOrder.Closed)
				{
					// Order has been closed, reset selection
					SelectedOrder = null;
					OrderDetails.Clear();
					UnorderedItems.Clear();
					ClearFormFields();
				}
				else
				{
					// Order is still open, reload details
					OrderDetails = ReceivingService.GetReceivingOrderDetails(SelectedOrder.PurchaseOrderID);
					UnorderedItems.Clear();
					ClearFormFields();
				}

				hasChanges = false;
				isFormValid = false;
				receiveForm.ResetTouched();

				StateHasChanged();
			}
			catch (ArgumentNullException ex)
			{
				errorMessage = BlazorHelperClass.GetInnerException(ex).Message;
			}
			catch (ArgumentException ex)
			{
				errorMessage = BlazorHelperClass.GetInnerException(ex).Message;
			}
			catch (AggregateException ex)
			{
				//  have a collection of errors
				if (!string.IsNullOrWhiteSpace(errorMessage))
				{
					errorMessage = $"{errorMessage}{Environment.NewLine}";
				}

				errorMessage = $"{errorMessage}Error processing receiving";
				foreach (var error in ex.InnerExceptions)
				{
					errorDetails.Add(error.Message);
				}
			}
			catch (Exception ex)
			{
				errorMessage = "Error processing receiving";
				errorDetails.Add(BlazorHelperClass.GetInnerException(ex).Message);
			}
		}

		/*
         * uses forceClose method from the service class . 
         * force closes an unfulfilled PO
         * checks a reason must be provided
         * confirms with the user with confirmdialog
         * processes the force close 
         * updates and refresh UI , reloads the PO list
         */
		private async Task ForceClose()
		{
			try
			{
				ClearMessages();

				//// Verify that the user is a manager
				//if (!await IsManagerAsync())
				//{
				//    errorMessage = "Only managers can force close orders.";
				//    Snackbar.Add("Only managers can force close orders.", Severity.Error);
				//    return;
				//}

				// Validate reason
				if (string.IsNullOrWhiteSpace(reason))
				{
					errorMessage = "A reason is required to force close an order.";
					Snackbar.Add("A reason is required to force close an order.", Severity.Warning);
					return;
				}

				// Confirm force close
				bool? result = await DialogService.ShowMessageBox(
					"Confirm Force Close",
					"Are you sure you want to force close this purchase order? This action cannot be undone.",
					yesText: "Yes", cancelText: "No");

				if (result == null)
				{
					return;
				}

				// Get current employee ID
				string employeeId = await GetCurrentEmployeeIdAsync();

				// Process force close
				ReceivingService.ForceClosePurchaseOrder(
					SelectedOrder.PurchaseOrderID,
					employeeId,
					OrderDetails,
					UnorderedItems,
					reason);

				feedbackMessage = $"Successfully force closed PO #{SelectedOrder.PurchaseOrderNumber}.";
				Snackbar.Add(feedbackMessage, Severity.Success);

				// Refresh the order list
				await LoadOutstandingOrders();

				// Reset selection as the order is now closed
				SelectedOrder = null;
				OrderDetails.Clear();
				UnorderedItems.Clear();
				ClearFormFields();

				hasChanges = false;
				isFormValid = false;
				receiveForm.ResetTouched();

				StateHasChanged();
			}
			catch (ArgumentNullException ex)
			{
				errorMessage = BlazorHelperClass.GetInnerException(ex).Message;
			}
			catch (ArgumentException ex)
			{
				errorMessage = BlazorHelperClass.GetInnerException(ex).Message;
			}
			catch (AggregateException ex)
			{
				//  have a collection of errors
				if (!string.IsNullOrWhiteSpace(errorMessage))
				{
					errorMessage = $"{errorMessage}{Environment.NewLine}";
				}

				errorMessage = $"{errorMessage}Error force closing purchase order";
				foreach (var error in ex.InnerExceptions)
				{
					errorDetails.Add(error.Message);
				}
			}
			catch (Exception ex)
			{
				errorMessage = "Error force closing purchase order";
				errorDetails.Add(BlazorHelperClass.GetInnerException(ex).Message);
			}
		}

		/*
         * adds an unordered item to the list for return
         * how?
         * validates the fields
         * adds the item to the non closed items list
         * clear the input fields
         * changes the boolean hasChanges to true
         */
		private void Insert()
		{
			try
			{
				ClearMessages();

				// Validate inputs
				if (string.IsNullOrWhiteSpace(description))
				{
					errorMessage = "Description is required for unordered items.";
					Snackbar.Add("Description is required for unordered items.", Severity.Warning);
					return;
				}

				if (string.IsNullOrWhiteSpace(vsn))
				{
					errorMessage = "Vendor Part ID is required for unordered items.";
					Snackbar.Add("Vendor Part ID is required for unordered items.", Severity.Warning);
					return;
				}

				if (qty <= 0)
				{
					errorMessage = "Quantity must be greater than zero.";
					Snackbar.Add("Quantity must be greater than zero.", Severity.Warning);
					return;
				}

				// Add to unordered items
				UnorderedItems.Add(new UnorderedReturnItemView
				{
					Description = description,
					VendorSerialNumber = vsn,
					Quantity = qty
				});

				// Clear input fields
				description = string.Empty;
				vsn = string.Empty;
				qty = 0;

				hasChanges = true;
				isFormValid = true;

				feedbackMessage = "Unordered item added successfully.";
				Snackbar.Add(feedbackMessage, Severity.Success);

				StateHasChanged();
			}
			catch (ArgumentNullException ex)
			{
				errorMessage = BlazorHelperClass.GetInnerException(ex).Message;
			}
			catch (ArgumentException ex)
			{
				errorMessage = BlazorHelperClass.GetInnerException(ex).Message;
			}
			catch (Exception ex)
			{
				errorMessage = "Error adding unordered item";
				errorDetails.Add(BlazorHelperClass.GetInnerException(ex).Message);
			}
		}

		/*
         removes an unordered item from the list
         param : unordered item viewmodel class
         */
		private void Delete(UnorderedReturnItemView item)
		{
			try
			{
				ClearMessages();

				UnorderedItems.Remove(item);
				hasChanges = true;
				isFormValid = true;

				feedbackMessage = "Unordered item removed.";
				Snackbar.Add(feedbackMessage, Severity.Info);

				StateHasChanged();
			}
			catch (Exception ex)
			{
				errorMessage = "Error removing unordered item";
				errorDetails.Add(BlazorHelperClass.GetInnerException(ex).Message);
			}
		}

		private void Clear()
		{
			ClearFormFields();
			StateHasChanged();
		}

		/*
         resets all the form fields to initial state, discards all the changes
         confirms for unsaved changes loss
         reloads PO list from bll
         clears unordered items 
         */
		private async Task Reset()
		{
			try
			{
				ClearMessages();

				if (hasChanges)
				{
					bool? result = await DialogService.ShowMessageBox(
						"Confirm Reset",
						"Resetting will clear all changes. Do you want to continue?",
						yesText: "Yes", cancelText: "No");

					if (result == null)
					{
						return;
					}
				}

				if (SelectedOrder != null)
				{
					// Reload the order details
					OrderDetails = ReceivingService.GetReceivingOrderDetails(SelectedOrder.PurchaseOrderID);
					UnorderedItems.Clear();
					ClearFormFields();

					hasChanges = false;
					isFormValid = false;
					receiveForm.ResetTouched();

					feedbackMessage = "Form has been reset.";
					Snackbar.Add(feedbackMessage, Severity.Info);

					StateHasChanged();
				}
			}
			catch (Exception ex)
			{
				errorMessage = "Error resetting form";
				errorDetails.Add(BlazorHelperClass.GetInnerException(ex).Message);
			}
		}

		// updates change tracking state when an order detail is modified
		// param: receiving detail view model
		private void UpdateOrderDetail(ReceivingDetailView detail)
		{
			// Mark that changes have been made
			hasChanges = true;
			isFormValid = true;
			bool hasActivity = OrderDetails.Any(d => d.Received > 0 || d.Returned > 0) || UnorderedItems.Any();
			isFormValid = hasActivity;
		}
		#endregion
	}
}
