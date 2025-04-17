using PurchaseOrderSystem.DAL;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace PurchaseOrderSystem.BLL
{
	public class PurchaseOrderService
	{
		private readonly eBike_2025_PO_Context _context;
		internal PurchaseOrderService(eBike_2025_PO_Context context)
		{
			_context = context;
		}

	}
}
