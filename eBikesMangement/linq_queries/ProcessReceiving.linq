<Query Kind="Program">
  <Connection>
    <ID>f33d1a5f-7b5a-41b0-b948-17d919659c45</ID>
    <NamingServiceVersion>2</NamingServiceVersion>
    <Persist>true</Persist>
    <Driver Assembly="(internal)" PublicKeyToken="no-strong-name">LINQPad.Drivers.EFCore.DynamicDriver</Driver>
    <AllowDateOnlyTimeOnly>true</AllowDateOnlyTimeOnly>
    <Server>ABHINAV-SCHOOL</Server>
    <Database>eBike_2025</Database>
    <DriverData>
      <EncryptSqlTraffic>True</EncryptSqlTraffic>
      <PreserveNumeric1>True</PreserveNumeric1>
      <EFProvider>Microsoft.EntityFrameworkCore.SqlServer</EFProvider>
    </DriverData>
  </Connection>
  <Namespace>Receiving</Namespace>
</Query>

#load "c:\dmit2018\linq_queries\PurchaseOrderView.linq"
#load "c:\dmit2018\linq_queries\ReceivingDetailView.linq"
#load "c:\dmit2018\linq_queries\UnorderedReturnItemView.linq"

void Main()
{
try{

}
catch(AggregateException ex)
	{
		foreach (var error in ex.InnerExceptions)
		{
            error.Message.Dump();
        }
	}
	catch(ArgumentNullException ex)
	{
		ex.Message.Dump();
	}
	catch(Exception ex)
	{
		ex.Message.Dump();
	}
}

	public void ProcessReceiving(int purchaseOrderID, string employeeId, List<ReceivingDetailView> receivingDetails, List<UnorderedReturnItemView> unorderedReturnItems, string reason)
		{
			try
			{
				// Validate receiving details
				List<Exception> errors = new();
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

					// If returning items, make sure there's a reason
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

				// If we have validation errors, throw them
				if (errors.Count > 0)
				{
					throw new AggregateException("Validation errors occurred while processing the receiving order.", errors);
				}

				// Create receive order
				var receiveOrder = new ReceiveOrder
				{
					PurchaseOrderID = purchaseOrderID,
					ReceiveDate = DateTime.Now,
					EmployeeID = employeeId
				};

				int orderRemainingQty = 0;

				foreach (ReceivingDetailView receivingDetail in receivingDetails)
				{
					orderRemainingQty += (receivingDetail.Outstanding - receivingDetail.Received);

					if (receivingDetail.Received > 0)
					{
						var receiveOrderDetail = new ReceiveOrderDetail
						{
							PurchaseOrderDetailID = receivingDetail.PurchaseOrderDetailID,
							QuantityReceived = receivingDetail.Received
						};

						receiveOrder.ReceiveOrderDetails.Add(receiveOrderDetail);

						Part updatePart = Parts.Find(receivingDetail.PartID);

						if (updatePart != null)
						{
							updatePart.QuantityOnHand += receivingDetail.Received;
							updatePart.QuantityOnOrder -= receivingDetail.Received;
						}
					}

					if (receivingDetail.Returned > 0)
					{
						var returnedOrderDetail = new ReturnedOrderDetail
						{
							PurchaseOrderDetailID = receivingDetail.PurchaseOrderDetailID,
							ItemDescription = receivingDetail.Description,
							Quantity = receivingDetail.Returned,
							Reason = receivingDetail.ReturnReason,
							VendorPartNumber = PurchaseOrderDetails
								.Where(pod => pod.PurchaseOrderDetailID == receivingDetail.PurchaseOrderDetailID)
								.Select(pod => pod.VendorPartNumber)
								.FirstOrDefault()
						};

						receiveOrder.ReturnedOrderDetails.Add(returnedOrderDetail);
					}
				}

				foreach (UnorderedReturnItemView unorderedItem in unorderedReturnItems)
				{
					if (unorderedItem.Quantity > 0)
					{
						var returnedOrderDetail = new ReturnedOrderDetail
						{
							ItemDescription = unorderedItem.Description,
							Quantity = unorderedItem.Quantity,
							Reason = "Item not ordered",
							VendorPartNumber = unorderedItem.VendorSerialNumber
						};

						receiveOrder.ReturnedOrderDetails.Add(returnedOrderDetail);
						
						var unorderedCartItem = new UnorderedPurchaseItemCart
						{
							Description = unorderedItem.Description,
							VendorPartNumber = unorderedItem.VendorSerialNumber,
							Quantity = unorderedItem.Quantity
						};
						
						receiveOrder.UnorderedPurchaseItemCarts.Add(unorderedCartItem);
					}
				}

				// Check if all items have been received - if so, close the purchase order
				if (orderRemainingQty == 0)
				{
					var purchaseOrder = PurchaseOrders.Find(purchaseOrderID);
					if (purchaseOrder != null)
					{
						purchaseOrder.Closed = true;
					}
				}

				ReceiveOrders.Add(receiveOrder);
				SaveChanges();
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