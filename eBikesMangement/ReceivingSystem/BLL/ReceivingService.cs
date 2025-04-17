using ReceivingSystem.DAL;
using ReceivingSystem.Entities;
using ReceivingSystem.ViewModels;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace ReceivingSystem.BLL
{
	public class ReceivingService
	{
		#region Fields

		/// <summary>
		/// The database context for eBikes
		/// </summary>
		private readonly eBike_2025Context _context;

		#endregion

		#region Constructor

		/// <summary>
		/// Initializes a new instance of the ReceivingService class
		/// </summary>
		/// <param name="context">The database context</param>
		internal ReceivingService(eBike_2025Context context)
		{
			_context = context;
		}

		#endregion

		#region Query Methods

		/// <summary>
		/// Gets all outstanding purchase orders that are not closed
		/// </summary>
		/// <returns>List of outstanding purchase orders</returns>
		public List<PurchaseOrderListViewModel> GetOutstandingOrders()
		{
			return _context.PurchaseOrders
				.Where(x => (x.Closed == false) && (x.OrderDate != null) && (x.RemoveFromViewFlag == false))
				.Select(x => new PurchaseOrderListViewModel
				{
					PurchaseOrderID = x.PurchaseOrderId,
					PurchaseOrderNumber = x.PurchaseOrderNumber,
					OrderDate = x.OrderDate.Value,
					VendorName = x.Vendor.VendorName,
					Phone = x.Vendor.Phone,
					Closed = x.Closed
				})
				.OrderByDescending(x => x.OrderDate)
				.ToList();
		}

		/// <summary>
		/// Gets a specific purchase order by ID
		/// </summary>
		/// <param name="id">The purchase order ID</param>
		/// <returns>The purchase order view model</returns>
		public PurchaseOrderListViewModel GetPurchaseOrderByID(int id)
		{
			return _context.PurchaseOrders
				.Where(x => x.PurchaseOrderId == id && !x.RemoveFromViewFlag)
				.Select(x => new PurchaseOrderListViewModel
				{
					PurchaseOrderID = x.PurchaseOrderId,
					PurchaseOrderNumber = x.PurchaseOrderNumber,
					OrderDate = x.OrderDate.Value,
					VendorName = x.Vendor.VendorName,
					Phone = x.Vendor.Phone,
					Closed = x.Closed
				})
				.FirstOrDefault();
		}

		/// <summary>
		/// Gets receiving details for a purchase order
		/// </summary>
		/// <param name="purchaseOrderID">The purchase order ID</param>
		/// <returns>List of receiving details</returns>
		public List<ReceivingDetailView> GetReceivingOrderDetails(int purchaseOrderID)
		{
			return _context.PurchaseOrderDetails
				.Where(x => x.PurchaseOrderId == purchaseOrderID && !x.RemoveFromViewFlag)
				.Select(x => new ReceivingDetailView
				{
					PurchaseOrderDetailID = x.PurchaseOrderDetailId,
					PartID = x.PartId,
					Description = x.Part.Description,
					Quantity = x.Quantity,
					Outstanding = x.Quantity - (x.ReceiveOrderDetails.Any() ? x.ReceiveOrderDetails.Sum(y => y.QuantityReceived) : 0),
					Received = 0,
					Returned = 0,
					ReturnReason = string.Empty,
					PurchasePrice = x.PurchasePrice
				})
				.Where(x => x.Outstanding > 0)
				.ToList();
		}

		#endregion

		#region Command Methods

		/// <summary>
		/// Processes the receiving of a purchase order
		/// </summary>
		/// <param name="purchaseOrderID">The purchase order ID</param>
		/// <param name="employeeId">The employee ID performing the operation</param>
		/// <param name="receivingDetails">The list of receiving details with updated quantities</param>
		/// <param name="unorderedReturnItems">The list of unordered items to return</param>
		/// <param name="reason">Optional reason for the operation</param>
		/// <exception cref="AggregateException">Thrown when validation errors occur</exception>
		/// <exception cref="ArgumentNullException">Thrown when required parameters are null</exception>
		/// <exception cref="ArgumentException">Thrown when parameters are invalid</exception>
		/// <exception cref="Exception">Thrown when other errors occur</exception>
		public void ProcessReceiving(int purchaseOrderID, string employeeId, List<ReceivingDetailView> receivingDetails,
			List<UnorderedReturnItemView> unorderedReturnItems, string reason)
		{
			try
			{
				#region Validation

				// Create list to hold validation errors
				List<Exception> errors = new();

				// Validate receiving details
				foreach (var item in receivingDetails)
				{
					// Check that received quantity doesn't exceed outstanding
					if (item.Received > item.Outstanding)
					{
						errors.Add(new Exception($"Part {item.PartID} ({item.Description}): Received quantity ({item.Received}) cannot exceed outstanding quantity ({item.Outstanding})."));
					}

					// Check for positive values
					if (item.Received < 0)
					{
						errors.Add(new Exception($"Part {item.PartID} ({item.Description}): Received quantity must be a positive value."));
					}

					if (item.Returned < 0)
					{
						errors.Add(new Exception($"Part {item.PartID} ({item.Description}): Returned quantity must be a positive value."));
					}

					// Ensures a reason is provided for returns
					if (item.Returned > 0 && string.IsNullOrWhiteSpace(item.ReturnReason))
					{
						errors.Add(new Exception($"Part {item.PartID} ({item.Description}): A reason must be provided for returned items."));
					}
				}

				// Validate unordered items
				foreach (var item in unorderedReturnItems)
				{
					if (string.IsNullOrWhiteSpace(item.Description))
					{
						errors.Add(new Exception("Unordered item: Description is required."));
					}

					if (string.IsNullOrWhiteSpace(item.VendorSerialNumber))
					{
						errors.Add(new Exception("Unordered item: Vendor Serial Number is required."));
					}

					if (item.Quantity <= 0)
					{
						errors.Add(new Exception("Unordered item: Quantity must be greater than zero."));
					}
				}

				// Throw exception if validation errors exist
				if (errors.Count > 0)
				{
					throw new AggregateException("Validation errors occurred while processing the receiving order.", errors);
				}

				#endregion

				#region Create Receive Order

				// Create new receive order
				var receiveOrder = new ReceiveOrder
				{
					PurchaseOrderId = purchaseOrderID,
					ReceiveDate = DateTime.Now,
					EmployeeId = employeeId
				};

				int orderRemainingQty = 0;

				#endregion

				#region Process Ordered Items

				// Process each item in receiving details
				foreach (ReceivingDetailView receivingDetail in receivingDetails)
				{
					// Calculate remaining quantity for order closing check
					orderRemainingQty += (receivingDetail.Outstanding - receivingDetail.Received);

					// Process received items
					if (receivingDetail.Received > 0)
					{
						// Create receive order detail record
						var receiveOrderDetail = new ReceiveOrderDetail
						{
							PurchaseOrderDetailId = receivingDetail.PurchaseOrderDetailID,
							QuantityReceived = receivingDetail.Received
						};

						// Add to receive order
						receiveOrder.ReceiveOrderDetails.Add(receiveOrderDetail);

						// Update inventory quantities
						Part updatePart = _context.Parts.Find(receivingDetail.PartID);
						if (updatePart != null)
						{
							updatePart.QuantityOnHand += receivingDetail.Received;
							updatePart.QuantityOnOrder -= receivingDetail.Received;
						}
					}

					// Process returned items
					if (receivingDetail.Returned > 0)
					{
						// Create return order detail record
						var returnedOrderDetail = new ReturnedOrderDetail
						{
							PurchaseOrderDetailId = receivingDetail.PurchaseOrderDetailID,
							ItemDescription = receivingDetail.Description,
							Quantity = receivingDetail.Returned,
							Reason = receivingDetail.ReturnReason,
							VendorPartNumber = _context.PurchaseOrderDetails
								.Where(pod => pod.PurchaseOrderDetailId == receivingDetail.PurchaseOrderDetailID)
								.Select(pod => pod.VendorPartNumber)
								.FirstOrDefault()
						};

						// Add to receive order
						receiveOrder.ReturnedOrderDetails.Add(returnedOrderDetail);
					}
				}

				#endregion

				#region Process Unordered Items

				// Process unordered items
				foreach (UnorderedReturnItemView unorderedItem in unorderedReturnItems)
				{
					if (unorderedItem.Quantity > 0)
					{
						// Create return order detail for unordered item
						var returnedOrderDetail = new ReturnedOrderDetail
						{
							ItemDescription = unorderedItem.Description,
							Quantity = unorderedItem.Quantity,
							Reason = "Item not ordered",
							VendorPartNumber = unorderedItem.VendorSerialNumber
						};

						receiveOrder.ReturnedOrderDetails.Add(returnedOrderDetail);

						// Create unordered item cart entry
						var unorderedCartItem = new UnorderedPurchaseItemCart
						{
							Description = unorderedItem.Description,
							VendorPartNumber = unorderedItem.VendorSerialNumber,
							Quantity = unorderedItem.Quantity
						};

						receiveOrder.UnorderedPurchaseItemCarts.Add(unorderedCartItem);
					}
				}

				#endregion

				#region Close Purchase Order If Complete

				// Check if all items have been received and close the PO if so
				if (orderRemainingQty == 0)
				{
					var purchaseOrder = _context.PurchaseOrders.Find(purchaseOrderID);
					if (purchaseOrder != null)
					{
						purchaseOrder.Closed = true;
					}
				}

				#endregion

				#region Save Changes

				// Add the receive order and save changes to database
				_context.ReceiveOrders.Add(receiveOrder);
				_context.SaveChanges();

				#endregion
			}
			catch (ArgumentNullException ex)
			{
				throw new ArgumentNullException(ex.Message);
			}
			catch (ArgumentException ex)
			{
				throw new ArgumentException(ex.Message);
			}
			catch (AggregateException ex)
			{
				throw ex;
			}
			catch (Exception ex)
			{
				throw new Exception($"An error occurred while processing the receiving: {ex.Message}", ex);
			}
		}

		/// <summary>
		/// Force closes a purchase order that cannot be fulfilled
		/// </summary>
		/// <param name="purchaseOrderID">The purchase order ID</param>
		/// <param name="employeeId">The employee ID performing the operation</param>
		/// <param name="receivingDetails">The list of receiving details</param>
		/// <param name="unorderedReturnItems">The list of unordered return items</param>
		/// <param name="reason">The reason for force closing</param>
		/// <exception cref="ArgumentException">Thrown when parameters are invalid</exception>
		/// <exception cref="AggregateException">Thrown when multiple errors occur</exception>
		/// <exception cref="Exception">Thrown when other errors occur</exception>
		public void ForceClosePurchaseOrder(int purchaseOrderID, string employeeId,
			List<ReceivingDetailView> receivingDetails, List<UnorderedReturnItemView> unorderedReturnItems, string reason)
		{
			try
			{
				#region Validation

				// Validate reason is provided
				if (string.IsNullOrWhiteSpace(reason))
				{
					throw new ArgumentException("A reason must be provided when force closing a purchase order.");
				}

				// Validate purchase order exists
				PurchaseOrder purchaseOrder = _context.PurchaseOrders.Find(purchaseOrderID);
				if (purchaseOrder == null)
				{
					throw new ArgumentException($"Purchase order with ID {purchaseOrderID} was not found.");
				}

				#endregion

				#region Update Inventory

				// Update inventory quantities for each outstanding item
				foreach (ReceivingDetailView receivingDetail in receivingDetails)
				{
					Part updatePart = _context.Parts.Find(receivingDetail.PartID);
					if (updatePart != null)
					{
						// Reduce quantity on order since items will not be received
						updatePart.QuantityOnOrder -= receivingDetail.Outstanding;
					}
				}

				#endregion

				#region Close Purchase Order

				// Update purchase order notes and set as closed
				purchaseOrder.Notes = reason;
				purchaseOrder.Closed = true;

				#endregion

				#region Save Changes

				// Save changes to database
				_context.SaveChanges();

				#endregion
			}
			catch (ArgumentNullException ex)
			{
				throw new ArgumentNullException(ex.Message);
			}
			catch (ArgumentException ex)
			{
				throw new ArgumentException(ex.Message);
			}
			catch (AggregateException ex)
			{
				List<Exception> errorList = new();
				foreach (var error in ex.InnerExceptions)
				{
					errorList.Add(new Exception(error.Message));
				}
				throw new AggregateException(ex.Message, errorList);
			}
			catch (Exception ex)
			{
				throw new Exception($"An error occurred while force closing the purchase order: {ex.Message}", ex);
			}
		}

		#endregion
	}
}
